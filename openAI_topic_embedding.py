"""Async OpenAI topic embedding utilities."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
from dataclasses import dataclass
from typing import Dict, List, Optional

import openai  # type: ignore[import-not-found]
import pandas as pd
from dotenv import load_dotenv
from openai import AsyncOpenAI  # type: ignore[import-not-found]
from tqdm import tqdm

logger = logging.getLogger(__name__)
load_dotenv()


@dataclass
class BackoffConfig:
    max_retries: int = 6
    base_delay: float = 1.0
    max_delay: float = 30.0


async def _sleep_with_jitter(base_delay: float, attempt: int, max_delay: float) -> None:
    delay = min(max_delay, base_delay * (2**attempt))
    jitter = random.uniform(0, base_delay)
    await asyncio.sleep(delay + jitter)


def _create_client() -> AsyncOpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    print("OpenAI API key loaded")
    if not api_key:
        raise EnvironmentError(
            "OPENAI_API_KEY environment variable is not set. "
            "Please export your OpenAI API key before calling embed_topics."
        )
    return AsyncOpenAI(api_key=api_key)


APIError = getattr(openai, "APIError", Exception)
APITimeoutError = getattr(openai, "APITimeoutError", Exception)
APIConnectionError = getattr(openai, "APIConnectionError", Exception)
RateLimitError = getattr(openai, "RateLimitError", Exception)
ServiceUnavailableError = getattr(openai, "ServiceUnavailableError", Exception)


def _should_retry(exc: Exception) -> bool:
    retryable = (
        RateLimitError,
        ServiceUnavailableError,
        APITimeoutError,
        APIConnectionError,
    )
    if isinstance(exc, retryable):
        return True
    if isinstance(exc, APIError):
        status = getattr(exc, "status", None) or getattr(exc, "status_code", None)
        return status in {408, 409, 425, 429, 500, 502, 503, 504}
    return False


def _normalise_topics(topics: List[str]) -> List[str]:
    return sorted({topic.strip() for topic in topics if topic and topic.strip()})


async def _embed_batch(
    client: AsyncOpenAI,
    batch_inputs: List[str],
    model: str,
    backoff: BackoffConfig,
) -> List[List[float]]:
    """Embed a batch of topics with retry logic."""
    last_error: Optional[Exception] = None
    for attempt in range(backoff.max_retries + 1):
        try:
            resp = await client.embeddings.create(model=model, input=batch_inputs)
            vectors = [list(d.embedding) for d in resp.data]
            return vectors
        except Exception as exc:  # noqa: BLE001 - deliberate broad catch for retries
            last_error = exc
            if not _should_retry(exc) or attempt == backoff.max_retries:
                logger.error(
                    "Failed to embed batch after %s attempts: %s", attempt + 1, exc
                )
                raise
            logger.warning(
                "Retrying batch (%s/%s) after error: %s",
                attempt + 1,
                backoff.max_retries,
                exc,
            )
            await _sleep_with_jitter(backoff.base_delay, attempt, backoff.max_delay)
    raise RuntimeError("Unexpected retry loop exit") from last_error


async def embed_topics(
    input_csv: str,
    output_csv: str,
    *,
    topic_col: str = "Topic",
    embedding_col: str = "Topic_Embedding",
    model: str = "text-embedding-3-large",
    batch_size: int = 128,
    concurrency: int = 8,
    backoff: Optional[BackoffConfig] = None,
) -> None:
    """Embed topics using OpenAI embeddings API asynchronously.

    Args:
        input_csv: Path to the input CSV file containing topics.
        output_csv: Path where the augmented CSV with embeddings will be saved.
        topic_col: Name of the column that stores topic text (default "Topic").
        embedding_col: Name of the column that will store embeddings (default "Topic_Embedding").
        model: OpenAI embedding model identifier (default "text-embedding-3-large").
        batch_size: Number of topics to embed per API call (default 128).
        concurrency: Maximum number of concurrent batch API calls (default 8).
        backoff: Optional BackoffConfig override.
    """
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )

    print(f"Loading CSV from {input_csv}...")
    df = pd.read_csv(input_csv)
    if topic_col not in df.columns:
        raise ValueError(f"Column '{topic_col}' not found in '{input_csv}'.")

    print(f"Found {len(df)} rows in {input_csv}.")

    if embedding_col not in df.columns:
        df[embedding_col] = None

    raw_topics = df[topic_col].fillna("").astype(str).tolist()
    unique_topics = _normalise_topics(raw_topics)

    print(f"Found {len(unique_topics)} unique topics to embed.")

    config = backoff or BackoffConfig()
    client = _create_client()
    semaphore = asyncio.Semaphore(max(1, concurrency))

    embeddings: Dict[str, List[float]] = {}

    batches = [
        unique_topics[i : i + batch_size]
        for i in range(0, len(unique_topics), batch_size)
    ]

    print(f"Processing {len(batches)} batches with concurrency {concurrency}...")

    with tqdm(
        total=len(unique_topics),
        desc="Embedding topics",
        unit="topic",
        ncols=100,
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}]",
    ) as progress:
        async def process_batch(batch_idx: int, batch: List[str]) -> None:
            async with semaphore:
                try:
                    vectors = await _embed_batch(client, batch, model, config)
                    for topic, vector in zip(batch, vectors):
                        embeddings[topic] = vector
                    progress.update(len(batch))
                    progress.set_postfix(
                        {
                            "batch": f"{batch_idx + 1}/{len(batches)}",
                            "size": len(batch),
                        }
                    )
                except Exception as exc:
                    logger.error(f"Batch {batch_idx + 1} failed: {exc}")
                    raise

        tasks = [
            asyncio.create_task(process_batch(idx, batch))
            for idx, batch in enumerate(batches)
        ]
        await asyncio.gather(*tasks)

    print("Closing client...")
    if hasattr(client, "aclose"):
        await client.aclose()

    print("Writing embeddings to DataFrame...")
    serialised: List[str] = []
    with tqdm(
        total=len(raw_topics),
        desc="Serializing embeddings",
        unit="row",
        ncols=100,
        bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}, {rate_fmt}]",
    ) as pbar:
        for topic in raw_topics:
            key = topic.strip()
            vector = embeddings.get(key) if key else None
            serialised.append(json.dumps(vector) if vector else "null")
            pbar.update(1)

    df[embedding_col] = serialised
    print(f"Saving to {output_csv}...")
    df.to_csv(output_csv, index=False)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(
        embed_topics(
            input_csv="/Users/varunsendilraj/Documents/GitHub/OpenClio/selected_conversations_with_topics.csv",
            output_csv="/Users/varunsendilraj/Documents/GitHub/OpenClio/selected_conversations_with_topics_embedded.csv",
            model="text-embedding-3-large",
            batch_size=128,
            concurrency=8,
        )
    )
