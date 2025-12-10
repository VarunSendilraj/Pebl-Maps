"""Async DeepSeek topic generation for conversation transcripts."""

from __future__ import annotations
from dotenv import load_dotenv

import asyncio
import logging
import os
import random
from dataclasses import dataclass
from typing import List, Optional

import openai  # type: ignore[import-not-found]
import pandas as pd
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
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "DEEPSEEK_API_KEY environment variable is not set. "
            "Please export your DeepSeek API key before calling generate_topics."
        )

    return AsyncOpenAI(api_key=api_key, base_url="https://api.deepseek.com")


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


async def _fetch_topic(
    client: AsyncOpenAI,
    conversation: str,
    model: str,
    backoff: BackoffConfig,
) -> str:
    print(f"Fetching topic for {conversation[:10]}...")
    conversation = conversation.strip()
    if not conversation:
        return "Topic not found"

    last_error: Optional[Exception] = None
    for attempt in range(backoff.max_retries + 1):
        try:
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {
                        "role": "user",
                        "content": (
                            "You are given a conversation trace representing an interaction between a user and an LLM assistant. "
                            "Each trace is formatted as a dictionary where each key is a turn_id, corresponding to a single exchange consisting of a user message and an assistant reply. "
                            "A turn_id represents one back-and-forth between the user and the LLM. "
                            "For example:\n\n"
                            "defaultdict(<class 'dict'>, {101001: {'user': 'Hey there! Are you familiar with reality shifting? So, I’m refining a foolproof method for reality shifting and want to pick a destination. Want to help me? ...', 'assistant': 'Hey there! I\\'m more than happy to help you plan your reality-shifting adventure, and I\\'ve got just the destination in mind for you ...'}})\n\n"
                            "Use all the turns in order to fully understand the flow and context of the conversation. "
                            "Here is the trace:"
                        ),
                    },
                    {"role": "user", "content": conversation},
                    {
                        "role": "user",
                        "content": "Give me a summary of the conversation the user had. ONLY RETURN THE SUMMARY, NO OTHER TEXT. THE SUMMARY SHOULD BE IN ENGLISH, BE A STRING (NO JSON OR MARKDOWN), AND AVOID ANY FLUFF IN THE SUMMARY.",
                    },
                ],
                temperature=0.0,
                max_tokens=300,
            )
            message = response.choices[0].message
            return (message.content or "").strip()
        except Exception as exc:  # noqa: BLE001 - deliberate broad catch for retries
            last_error = exc
            if not _should_retry(exc) or attempt == backoff.max_retries:
                logger.error(
                    "Failed to fetch topic after %s attempts: %s", attempt + 1, exc
                )
                raise
            logger.warning(
                "Retrying (%s/%s) after error: %s",
                attempt + 1,
                backoff.max_retries,
                exc,
            )
            await _sleep_with_jitter(backoff.base_delay, attempt, backoff.max_delay)
    raise RuntimeError("Unexpected retry loop exit") from last_error


async def _generate_topics_async(
    input_csv: str,
    output_csv: str,
    column_name: str,
    model: str,
    concurrency: int,
    backoff: BackoffConfig,
) -> None:
    print(f"Generating topics for {input_csv}...")
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )
    df = pd.read_csv(input_csv)
    if column_name not in df.columns:
        raise ValueError(f"Column '{column_name}' not found in '{input_csv}'.")
    print(f"Found {len(df)} rows in {input_csv}.")

    print("Creating client...")
    client = _create_client()
    # Create a semaphore to limit the number of concurrent API calls.
    semaphore = asyncio.Semaphore(max(1, concurrency))
    total = len(df)
    results: List[Optional[str]] = [None] * total

    async def process_row(index: int, text: str) -> None:
        async with semaphore:
            try:
                topic = await _fetch_topic(client, text, model, backoff)
            except Exception as exc:  # noqa: BLE001
                logger.exception("Row %s failed: %s", index, exc)
                topic = ""
            results[index] = topic
        progress.update(1)
        if topic:
            progress.write(f"Row {index} topic: {topic}")

    with tqdm(total=total, desc="Generating topics", unit="conv") as progress:
        tasks = [
            asyncio.create_task(process_row(idx, str(text) if pd.notna(text) else ""))
            for idx, text in enumerate(df[column_name])
        ]
        await asyncio.gather(*tasks)

    print("Closing client...")
    if hasattr(client, "aclose"):
        await client.aclose()

    df["Topic"] = results
    df.to_csv(output_csv, index=False)


def generate_topics(
    input_csv: str,
    output_csv: str,
    column_name: str = "Conversation",
    model: str = "deepseek-chat",
    concurrency: int = 8,
    backoff: Optional[BackoffConfig] = None,
) -> None:
    """
    Generate conversation topics using DeepSeek and write them to a new CSV.

    Args:
        input_csv: Path to the input CSV file containing conversations.
        output_csv: Path where the augmented CSV with topics will be saved.
        column_name: Name of the column that stores conversation text.
        model: DeepSeek model identifier (default "deepseek-chat").
        concurrency: Maximum number of concurrent API calls.
        backoff: Optional BackoffConfig override.
    """

    config = backoff or BackoffConfig()
    asyncio.run(
        _generate_topics_async(
            input_csv=input_csv,
            output_csv=output_csv,
            column_name=column_name,
            model=model,
            concurrency=concurrency,
            backoff=config,
        )
    )
