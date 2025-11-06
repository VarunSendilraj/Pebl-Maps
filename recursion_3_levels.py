"""Recursive hierarchical clustering with DeepSeek labeling and OpenAI embeddings."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import random
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import numpy as np
import openai  # type: ignore[import-not-found]
import pandas as pd
from dotenv import load_dotenv
from openai import AsyncOpenAI, OpenAI  # type: ignore[import-not-found]
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler
from tqdm import tqdm

logger = logging.getLogger(__name__)
load_dotenv()


@dataclass
class BackoffConfig:
    max_retries: int = 6
    base_delay: float = 1.0
    max_delay: float = 30.0


@dataclass
class ClusteringConfig:
    ks: List[int] = None  # type: ignore[assignment]
    random_state: int = 42
    deepseek_model: str = "deepseek-chat"
    embedding_model: str = "text-embedding-3-large"
    embedding_batch_size: int = 128
    embedding_concurrency: int = 8
    deepseek_concurrency: int = 5
    max_items_per_prompt: int = 60
    max_chars_per_prompt: int = 8000
    backoff: Optional[BackoffConfig] = None

    def __post_init__(self) -> None:
        if self.ks is None:
            self.ks = [50, 25, 5]
        if self.backoff is None:
            self.backoff = BackoffConfig()


async def _sleep_with_jitter(base_delay: float, attempt: int, max_delay: float) -> None:
    delay = min(max_delay, base_delay * (2**attempt))
    jitter = random.uniform(0, base_delay)
    await asyncio.sleep(delay + jitter)


def _should_retry(exc: Exception) -> bool:
    retryable = (
        getattr(openai, "RateLimitError", Exception),
        getattr(openai, "ServiceUnavailableError", Exception),
        getattr(openai, "APITimeoutError", Exception),
        getattr(openai, "APIConnectionError", Exception),
    )
    if isinstance(exc, retryable):
        return True
    APIError = getattr(openai, "APIError", Exception)
    if isinstance(exc, APIError):
        status = getattr(exc, "status", None) or getattr(exc, "status_code", None)
        return status in {408, 409, 425, 429, 500, 502, 503, 504}
    return False


def _create_deepseek_client() -> OpenAI:
    api_key = os.environ.get("DEEPSEEK_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "DEEPSEEK_API_KEY environment variable is not set. "
            "Please set it in your .env file."
        )
    return OpenAI(api_key=api_key, base_url="https://api.deepseek.com")


def _create_embedding_client() -> AsyncOpenAI:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError(
            "OPENAI_API_KEY environment variable is not set. "
            "Please set it in your .env file."
        )
    return AsyncOpenAI(api_key=api_key)


async def _embed_batch(
    client: AsyncOpenAI,
    texts: List[str],
    model: str,
    backoff: BackoffConfig,
) -> List[List[float]]:
    """Embed a batch of texts with retry logic."""
    last_error: Optional[Exception] = None
    for attempt in range(backoff.max_retries + 1):
        try:
            resp = await client.embeddings.create(model=model, input=texts)
            return [list(d.embedding) for d in resp.data]
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if not _should_retry(exc) or attempt == backoff.max_retries:
                logger.error(
                    "Failed to embed batch after %s attempts: %s", attempt + 1, exc
                )
                raise
            logger.warning(
                "Retrying embedding batch (%s/%s) after error: %s",
                attempt + 1,
                backoff.max_retries,
                exc,
            )
            await _sleep_with_jitter(backoff.base_delay, attempt, backoff.max_delay)
    raise RuntimeError("Unexpected retry loop exit") from last_error


async def _embed_descriptions_async(
    descriptions: List[str],
    client: AsyncOpenAI,
    config: ClusteringConfig,
) -> List[List[float]]:
    """Embed descriptions asynchronously with batching."""
    batches = [
        descriptions[i : i + config.embedding_batch_size]
        for i in range(0, len(descriptions), config.embedding_batch_size)
    ]
    semaphore = asyncio.Semaphore(config.embedding_concurrency)
    embeddings: List[List[float]] = []

    async def process_batch(batch: List[str]) -> None:
        async with semaphore:
            vectors = await _embed_batch(
                client, batch, config.embedding_model, config.backoff
            )
            embeddings.extend(vectors)

    with tqdm(
        total=len(descriptions),
        desc="Embedding descriptions",
        unit="desc",
        ncols=100,
    ) as progress:
        tasks = [asyncio.create_task(process_batch(batch)) for batch in batches]

        async def update_progress() -> None:
            while len(embeddings) < len(descriptions):
                await asyncio.sleep(0.1)
                progress.n = len(embeddings)
                progress.refresh()

        await asyncio.gather(*tasks, update_progress())
        progress.n = len(descriptions)
        progress.refresh()

    return embeddings


def _label_cluster_with_deepseek(
    client: OpenAI,
    items: List[str],
    config: ClusteringConfig,
    cluster_id: int,
    level: int,
) -> Dict[str, Any]:
    """Label a cluster using DeepSeek API with retry logic."""
    # Truncate items if needed
    if len(items) > config.max_items_per_prompt:
        items = items[: config.max_items_per_prompt]
        items.append(f"... and {len(items) - config.max_items_per_prompt} more items")

    # Build prompt
    items_text = "\n".join([f"- {item}" for item in items])
    items_text = items_text[: config.max_chars_per_prompt]

    if level == 0:
        prompt = f"""You are analyzing a cluster of related conversation topics. Below are all the topics in this cluster:

{items_text}

Please analyze these topics and provide:
1. A short, concise label (2-5 words) that captures the main theme
2. A detailed description (2-3 sentences) explaining what this cluster represents

Format your response as JSON with exactly these keys:
- "label": the short label
- "description": the detailed description

Only return the JSON, no other text."""
    else:
        prompt = f"""You are analyzing a cluster of related sub-clusters. Below are the descriptions of the sub-clusters in this cluster:

{items_text}

Please analyze these sub-cluster descriptions and provide:
1. A short, concise label (2-5 words) that captures the main theme of this parent cluster
2. A detailed description (2-3 sentences) explaining what this higher-level cluster represents

Format your response as JSON with exactly these keys:
- "label": the short label
- "description": the detailed description

Only return the JSON, no other text."""

    last_error: Optional[Exception] = None
    for attempt in range(config.backoff.max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=config.deepseek_model,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.2,
            )
            content = response.choices[0].message.content or "{}"
            result = json.loads(content)
            if "label" not in result or "description" not in result:
                raise ValueError("Invalid JSON response from DeepSeek")
            return {"label": result["label"], "description": result["description"]}
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if not _should_retry(exc) or attempt == config.backoff.max_retries:
                logger.error(
                    "Failed to label cluster %s (level %s) after %s attempts: %s",
                    cluster_id,
                    level,
                    attempt + 1,
                    exc,
                )
                # Return fallback
                return {
                    "label": f"Cluster {cluster_id}",
                    "description": f"Cluster {cluster_id} at level {level}",
                }
            logger.warning(
                "Retrying cluster labeling (%s/%s) after error: %s",
                attempt + 1,
                config.backoff.max_retries,
                exc,
            )
            time.sleep(config.backoff.base_delay * (2**attempt))
    raise RuntimeError("Unexpected retry loop exit") from last_error


@dataclass
class ClusterNode:
    level: int
    node_id: int
    parent_id: Optional[int]
    k_at_level: int
    label: str
    description: str
    description_embedding: Optional[List[float]]
    num_children: int
    children_refs: List[int]  # topic indices for L0, node_ids for L1/L2

    def to_dict(self) -> Dict[str, Any]:
        return {
            "level": self.level,
            "node_id": self.node_id,
            "parent_id": self.parent_id if self.parent_id is not None else "",
            "k_at_level": self.k_at_level,
            "label": self.label,
            "description": self.description,
            "description_embedding_json": (
                json.dumps(self.description_embedding)
                if self.description_embedding
                else "null"
            ),
            "num_children": self.num_children,
            "children_ref_json": json.dumps(self.children_refs),
        }


async def _process_level_0(
    topics: List[str],
    embeddings: np.ndarray,
    deepseek_client: OpenAI,
    embed_client: AsyncOpenAI,
    config: ClusteringConfig,
) -> List[ClusterNode]:
    """Process level 0: cluster topics at k=50, label, and embed descriptions."""
    k = config.ks[0]
    print(f"\n{'='*80}")
    print(f"LEVEL 0: Clustering {len(topics)} topics into {k} clusters")
    print(f"{'='*80}")

    # Cluster
    print("Performing K-means clustering...")
    scaler = StandardScaler()
    embeddings_scaled = scaler.fit_transform(embeddings)
    kmeans = KMeans(n_clusters=k, random_state=config.random_state, n_init=10)
    cluster_labels = kmeans.fit_predict(embeddings_scaled)

    # Build nodes
    print("Building cluster nodes...")
    nodes: List[ClusterNode] = []
    for cluster_id in range(k):
        mask = cluster_labels == cluster_id
        topic_indices = np.where(mask)[0].tolist()
        cluster_topics = [topics[i] for i in topic_indices]

        nodes.append(
            ClusterNode(
                level=0,
                node_id=cluster_id,
                parent_id=None,
                k_at_level=k,
                label="",  # Will be filled
                description="",  # Will be filled
                description_embedding=None,  # Will be filled
                num_children=len(topic_indices),
                children_refs=topic_indices,
            )
        )

    # Label with DeepSeek
    print("Labeling clusters with DeepSeek...")
    semaphore = asyncio.Semaphore(config.deepseek_concurrency)

    async def label_node(node: ClusterNode) -> None:
        async with semaphore:
            topic_indices = node.children_refs
            cluster_topics = [topics[i] for i in topic_indices]
            result = await asyncio.to_thread(
                _label_cluster_with_deepseek,
                deepseek_client,
                cluster_topics,
                config,
                node.node_id,
                0,
            )
            node.label = result["label"]
            node.description = result["description"]

    with tqdm(total=len(nodes), desc="Labeling L0 clusters", unit="cluster") as pbar:
        tasks = [asyncio.create_task(label_node(node)) for node in nodes]

        async def update_progress() -> None:
            while any(not node.label for node in nodes):
                await asyncio.sleep(0.1)
                completed = sum(1 for node in nodes if node.label)
                pbar.n = completed
                pbar.refresh()

        await asyncio.gather(*tasks)
        pbar.n = len(nodes)
        pbar.refresh()

    # Embed descriptions
    print("Embedding cluster descriptions...")
    descriptions = [node.description for node in nodes]
    description_embeddings = await _embed_descriptions_async(
        descriptions, embed_client, config
    )
    for node, emb in zip(nodes, description_embeddings):
        node.description_embedding = emb

    print(f"Level 0 complete: {len(nodes)} clusters created")
    return nodes


async def _process_level_n(
    parent_nodes: List[ClusterNode],
    level: int,
    deepseek_client: OpenAI,
    embed_client: AsyncOpenAI,
    config: ClusteringConfig,
) -> List[ClusterNode]:
    """Process level N (1 or 2): cluster parent nodes, label, and embed descriptions."""
    k = config.ks[level]
    print(f"\n{'='*80}")
    print(f"LEVEL {level}: Clustering {len(parent_nodes)} nodes into {k} clusters")
    print(f"{'='*80}")

    # Extract embeddings
    embeddings_array = np.array([node.description_embedding for node in parent_nodes])

    # Cluster
    print("Performing K-means clustering...")
    scaler = StandardScaler()
    embeddings_scaled = scaler.fit_transform(embeddings_array)
    kmeans = KMeans(n_clusters=k, random_state=config.random_state, n_init=10)
    cluster_labels = kmeans.fit_predict(embeddings_scaled)

    # Build nodes
    print("Building cluster nodes...")
    nodes: List[ClusterNode] = []
    for cluster_id in range(k):
        mask = cluster_labels == cluster_id
        parent_node_indices = np.where(mask)[0].tolist()
        parent_node_ids = [parent_nodes[i].node_id for i in parent_node_indices]

        nodes.append(
            ClusterNode(
                level=level,
                node_id=cluster_id,
                parent_id=None,  # Will be set later
                k_at_level=k,
                label="",  # Will be filled
                description="",  # Will be filled
                description_embedding=None,  # Will be filled
                num_children=len(parent_node_indices),
                children_refs=parent_node_ids,
            )
        )

    # Label with DeepSeek
    print("Labeling clusters with DeepSeek...")
    semaphore = asyncio.Semaphore(config.deepseek_concurrency)

    async def label_node(node: ClusterNode) -> None:
        async with semaphore:
            parent_node_ids = node.children_refs
            child_descriptions = [
                parent_nodes[i].description
                for i, parent_node in enumerate(parent_nodes)
                if parent_node.node_id in parent_node_ids
            ]
            result = await asyncio.to_thread(
                _label_cluster_with_deepseek,
                deepseek_client,
                child_descriptions,
                config,
                node.node_id,
                level,
            )
            node.label = result["label"]
            node.description = result["description"]

    with tqdm(
        total=len(nodes), desc=f"Labeling L{level} clusters", unit="cluster"
    ) as pbar:
        tasks = [asyncio.create_task(label_node(node)) for node in nodes]

        async def update_progress() -> None:
            while any(not node.label for node in nodes):
                await asyncio.sleep(0.1)
                completed = sum(1 for node in nodes if node.label)
                pbar.n = completed
                pbar.refresh()

        await asyncio.gather(*tasks)
        pbar.n = len(nodes)
        pbar.refresh()

    # Set parent_ids for parent nodes
    for node in nodes:
        for parent_node_id in node.children_refs:
            for parent_node in parent_nodes:
                if parent_node.node_id == parent_node_id:
                    parent_node.parent_id = node.node_id
                    break

    # Embed descriptions (only if not last level)
    if level < len(config.ks) - 1:
        print("Embedding cluster descriptions...")
        descriptions = [node.description for node in nodes]
        description_embeddings = await _embed_descriptions_async(
            descriptions, embed_client, config
        )
        for node, emb in zip(nodes, description_embeddings):
            node.description_embedding = emb
    else:
        # Last level: no embedding needed
        for node in nodes:
            node.description_embedding = None

    print(f"Level {level} complete: {len(nodes)} clusters created")
    return nodes


def _build_assignments(all_nodes: List[ClusterNode], topics: List[str]) -> pd.DataFrame:
    """Build per-topic assignment DataFrame."""
    # Create mapping: topic_index -> L0 -> L1 -> L2
    l0_nodes = [n for n in all_nodes if n.level == 0]
    l1_nodes = [n for n in all_nodes if n.level == 1]
    l2_nodes = [n for n in all_nodes if n.level == 2]

    # Build topic -> L0 mapping
    topic_to_l0: Dict[int, int] = {}
    for node in l0_nodes:
        for topic_idx in node.children_refs:
            topic_to_l0[topic_idx] = node.node_id

    # Build L0 -> L1 mapping
    l0_to_l1: Dict[int, int] = {}
    for node in l0_nodes:
        if node.parent_id is not None:
            l0_to_l1[node.node_id] = node.parent_id

    # Build L1 -> L2 mapping
    l1_to_l2: Dict[int, int] = {}
    for node in l1_nodes:
        if node.parent_id is not None:
            l1_to_l2[node.node_id] = node.parent_id

    # Create node lookup
    node_lookup: Dict[tuple[int, int], ClusterNode] = {}
    for node in all_nodes:
        node_lookup[(node.level, node.node_id)] = node

    # Build assignments
    assignments = []
    for topic_idx in range(len(topics)):
        l0_id = topic_to_l0.get(topic_idx)
        l1_id = l0_to_l1.get(l0_id) if l0_id is not None else None
        l2_id = l1_to_l2.get(l1_id) if l1_id is not None else None

        l0_label = (
            node_lookup[(0, l0_id)].label
            if l0_id is not None and (0, l0_id) in node_lookup
            else ""
        )
        l1_label = (
            node_lookup[(1, l1_id)].label
            if l1_id is not None and (1, l1_id) in node_lookup
            else ""
        )
        l2_label = (
            node_lookup[(2, l2_id)].label
            if l2_id is not None and (2, l2_id) in node_lookup
            else ""
        )

        assignments.append(
            {
                "topic_index": topic_idx,
                "cluster_L0_id": l0_id if l0_id is not None else "",
                "cluster_L0_label": l0_label,
                "cluster_L1_id": l1_id if l1_id is not None else "",
                "cluster_L1_label": l1_label,
                "cluster_L2_id": l2_id if l2_id is not None else "",
                "cluster_L2_label": l2_label,
            }
        )

    return pd.DataFrame(assignments)


def _build_augmented_dataframe(
    original_df: pd.DataFrame,
    all_nodes: List[ClusterNode],
    valid_indices: List[int],
) -> pd.DataFrame:
    """Build augmented DataFrame with clustering columns appended to original data."""
    # Create mapping: topic_index -> L0 -> L1 -> L2
    l0_nodes = [n for n in all_nodes if n.level == 0]
    l1_nodes = [n for n in all_nodes if n.level == 1]
    l2_nodes = [n for n in all_nodes if n.level == 2]

    # Build topic -> L0 mapping
    # node.children_refs contains indices into the filtered topics list (0, 1, 2, ...)
    # We need to map these to original dataframe indices via valid_indices
    topic_to_l0: Dict[int, int] = {}
    for node in l0_nodes:
        for filtered_topic_idx in node.children_refs:
            # Map from filtered topic index to original dataframe index
            if filtered_topic_idx < len(valid_indices):
                original_idx = valid_indices[filtered_topic_idx]
                topic_to_l0[original_idx] = node.node_id

    # Build L0 -> L1 mapping
    l0_to_l1: Dict[int, int] = {}
    for node in l0_nodes:
        if node.parent_id is not None:
            l0_to_l1[node.node_id] = node.parent_id

    # Build L1 -> L2 mapping
    l1_to_l2: Dict[int, int] = {}
    for node in l1_nodes:
        if node.parent_id is not None:
            l1_to_l2[node.node_id] = node.parent_id

    # Create node lookup
    node_lookup: Dict[tuple[int, int], ClusterNode] = {}
    for node in all_nodes:
        node_lookup[(node.level, node.node_id)] = node

    # Create a copy of the original dataframe
    augmented_df = original_df.copy()

    # Initialize clustering columns
    for level in [0, 1, 2]:
        augmented_df[f"L{level}_cluster_id"] = ""
        augmented_df[f"L{level}_cluster_label"] = ""
        augmented_df[f"L{level}_cluster_description"] = ""
        augmented_df[f"L{level}_cluster_description_embedding"] = ""

    # Fill in clustering data for rows with valid embeddings
    for original_idx in valid_indices:
        # Get cluster assignments
        l0_id = topic_to_l0.get(original_idx)
        l1_id = l0_to_l1.get(l0_id) if l0_id is not None else None
        l2_id = l1_to_l2.get(l1_id) if l1_id is not None else None

        # Fill Level 0
        if l0_id is not None and (0, l0_id) in node_lookup:
            l0_node = node_lookup[(0, l0_id)]
            augmented_df.at[original_idx, "L0_cluster_id"] = l0_id
            augmented_df.at[original_idx, "L0_cluster_label"] = l0_node.label
            augmented_df.at[original_idx, "L0_cluster_description"] = (
                l0_node.description
            )
            augmented_df.at[original_idx, "L0_cluster_description_embedding"] = (
                json.dumps(l0_node.description_embedding)
                if l0_node.description_embedding
                else ""
            )

        # Fill Level 1
        if l1_id is not None and (1, l1_id) in node_lookup:
            l1_node = node_lookup[(1, l1_id)]
            augmented_df.at[original_idx, "L1_cluster_id"] = l1_id
            augmented_df.at[original_idx, "L1_cluster_label"] = l1_node.label
            augmented_df.at[original_idx, "L1_cluster_description"] = (
                l1_node.description
            )
            augmented_df.at[original_idx, "L1_cluster_description_embedding"] = (
                json.dumps(l1_node.description_embedding)
                if l1_node.description_embedding
                else ""
            )

        # Fill Level 2
        if l2_id is not None and (2, l2_id) in node_lookup:
            l2_node = node_lookup[(2, l2_id)]
            augmented_df.at[original_idx, "L2_cluster_id"] = l2_id
            augmented_df.at[original_idx, "L2_cluster_label"] = l2_node.label
            augmented_df.at[original_idx, "L2_cluster_description"] = (
                l2_node.description
            )
            augmented_df.at[original_idx, "L2_cluster_description_embedding"] = (
                json.dumps(l2_node.description_embedding)
                if l2_node.description_embedding
                else ""
            )

    return augmented_df


async def recursive_cluster(
    input_csv: str,
    output_nodes_csv: str,
    output_assignments_csv: str,
    output_augmented_csv: Optional[str] = None,
    config: Optional[ClusteringConfig] = None,
) -> None:
    """Main recursive clustering pipeline.

    Args:
        input_csv: Path to input CSV with topics and embeddings
        output_nodes_csv: Path to save hierarchy nodes CSV
        output_assignments_csv: Path to save topic assignments CSV
        output_augmented_csv: Optional path to save augmented CSV with original data + clustering columns
        config: Optional clustering configuration
    """
    if config is None:
        config = ClusteringConfig()

    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s"
    )

    print(f"Loading CSV from {input_csv}...")
    df = pd.read_csv(input_csv)

    if "Topic" not in df.columns:
        raise ValueError(f"Column 'Topic' not found in '{input_csv}'")
    if "Topic_Embedding" not in df.columns:
        raise ValueError(f"Column 'Topic_Embedding' not found in '{input_csv}'")

    # Parse topics and embeddings
    topics = df["Topic"].fillna("").astype(str).tolist()
    embeddings_list: List[List[float]] = []
    valid_indices: List[int] = []

    print("Parsing embeddings...")
    for idx, emb_str in enumerate(df["Topic_Embedding"]):
        if pd.isna(emb_str) or emb_str == "null" or emb_str == "":
            continue
        try:
            emb = json.loads(emb_str)
            if isinstance(emb, list) and len(emb) > 0:
                embeddings_list.append(emb)
                valid_indices.append(idx)
        except (json.JSONDecodeError, TypeError):
            continue

    # Filter topics to valid indices
    topics = [topics[i] for i in valid_indices]
    embeddings = np.array(embeddings_list)

    print(f"Loaded {len(topics)} valid topics with embeddings")

    # Initialize clients
    deepseek_client = _create_deepseek_client()
    embed_client = _create_embedding_client()

    try:
        # Level 0
        l0_nodes = await _process_level_0(
            topics, embeddings, deepseek_client, embed_client, config
        )

        # Level 1
        l1_nodes = await _process_level_n(
            l0_nodes, 1, deepseek_client, embed_client, config
        )

        # Level 2
        l2_nodes = await _process_level_n(
            l1_nodes, 2, deepseek_client, embed_client, config
        )

        # Collect all nodes
        all_nodes = l0_nodes + l1_nodes + l2_nodes

        # Build and save outputs
        print("\n" + "=" * 80)
        print("Building output DataFrames...")
        print("=" * 80)

        # Nodes CSV
        nodes_df = pd.DataFrame([node.to_dict() for node in all_nodes])
        nodes_df = nodes_df.sort_values(["level", "node_id"])
        print(f"Saving nodes to {output_nodes_csv}...")
        nodes_df.to_csv(output_nodes_csv, index=False)

        # Assignments CSV
        assignments_df = _build_assignments(all_nodes, topics)
        print(f"Saving assignments to {output_assignments_csv}...")
        assignments_df.to_csv(output_assignments_csv, index=False)

        # Augmented CSV (original data + clustering columns)
        if output_augmented_csv:
            print(
                f"Building augmented dataframe with original data + clustering columns..."
            )
            augmented_df = _build_augmented_dataframe(df, all_nodes, valid_indices)
            print(f"Saving augmented CSV to {output_augmented_csv}...")
            augmented_df.to_csv(output_augmented_csv, index=False)
            print(
                f"Augmented CSV saved with {len(augmented_df)} rows and {len(augmented_df.columns)} columns"
            )

        print("\n" + "=" * 80)
        print("COMPLETE!")
        print("=" * 80)
        print(f"Total nodes: {len(all_nodes)}")
        print(f"  - Level 0: {len(l0_nodes)}")
        print(f"  - Level 1: {len(l1_nodes)}")
        print(f"  - Level 2: {len(l2_nodes)}")
        print(f"Total topics: {len(topics)}")

    finally:
        if hasattr(embed_client, "aclose"):
            await embed_client.aclose()


if __name__ == "__main__":
    asyncio.run(
        recursive_cluster(
            input_csv="selected_conversations_with_topics_embedded.csv",
            output_nodes_csv="cluster_hierarchy_nodes.csv",
            output_assignments_csv="cluster_assignments_levels.csv",
            output_augmented_csv="selected_conversations_with_topics_embedded_clustered.csv",
            config=ClusteringConfig(ks=[50, 25, 5]),
        )
    )
