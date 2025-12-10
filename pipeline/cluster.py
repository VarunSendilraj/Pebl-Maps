import pandas as pd
import numpy as np
import json
import asyncio
import os
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from sklearn.cluster import KMeans
from openai import AsyncOpenAI
from tqdm import tqdm
from dotenv import load_dotenv
import logging

load_dotenv()
logger = logging.getLogger(__name__)


@dataclass
class ClusterConfig:
    l2_clusters: int = 5
    l1_clusters: int = 5
    l0_clusters: int = 5
    model: str = "gpt-4o"  # or deepseek-chat


def parse_embedding(emb_str: str) -> Optional[List[float]]:
    try:
        if pd.isna(emb_str) or emb_str == "null" or emb_str == "":
            return None
        return json.loads(emb_str)
    except Exception:
        return None


async def generate_label(
    client: AsyncOpenAI, topics: List[str], level: str, model: str
) -> Tuple[str, str]:
    """Generates a label and description for a cluster of topics."""
    prompt = f"""
    Analyze the following list of topics from a conversation dataset. 
    Generate a concise title (label) and a 1-sentence description for this cluster of topics.
    
    Level: {level} (L2 is broad category, L0 is specific sub-topic)
    
    Topics:
    {json.dumps(topics[:50], indent=2)}
    
    Return JSON format: {{ "label": "...", "description": "..." }}
    """

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that categorizes topics. Output JSON only.",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
        )
        content = response.choices[0].message.content
        data = json.loads(content)
        return data.get("label", "Unknown Cluster"), data.get(
            "description", "No description"
        )
    except Exception as e:
        logger.error(f"Error generating label: {e}")
        return f"Cluster {level}", "Error generating description"


async def embed_text(
    client: AsyncOpenAI, text: str, model: str = "text-embedding-3-large"
) -> List[float]:
    """Embeds a single string."""
    try:
        resp = await client.embeddings.create(model=model, input=text)
        return list(resp.data[0].embedding)
    except Exception as e:
        logger.error(f"Error embedding text: {e}")
        return []


async def process_clustering(
    input_csv: str, output_csv: str, config: ClusterConfig = ClusterConfig()
):
    print(f"Loading {input_csv}...")
    df = pd.read_csv(input_csv)

    if "Topic_Embedding" not in df.columns:
        raise ValueError("CSV must contain 'Topic_Embedding' column")

    # Parse embeddings
    df["embedding_vec"] = df["Topic_Embedding"].apply(parse_embedding)
    valid_mask = df["embedding_vec"].notna()
    valid_df = df[valid_mask].copy()

    if len(valid_df) == 0:
        raise ValueError("No valid embeddings found")

    embeddings = np.stack(valid_df["embedding_vec"].values)
    print(f"Clustering {len(embeddings)} items...")

    client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

    # --- L2 Clustering ---
    print("Performing L2 Clustering...")
    kmeans_l2 = KMeans(
        n_clusters=min(config.l2_clusters, len(valid_df)), random_state=42
    )
    l2_labels = kmeans_l2.fit_predict(embeddings)
    valid_df["L2_cluster_id"] = l2_labels

    # --- L1 Clustering ---
    print("Performing L1 Clustering...")
    valid_df["L1_cluster_id"] = -1
    for l2_id in range(config.l2_clusters):
        l2_mask = valid_df["L2_cluster_id"] == l2_id
        l2_data = embeddings[l2_mask]

        if len(l2_data) < config.l1_clusters:
            # Too few points, just assign 0
            valid_df.loc[l2_mask, "L1_cluster_id"] = 0
            continue

        kmeans_l1 = KMeans(n_clusters=config.l1_clusters, random_state=42)
        l1_sub_labels = kmeans_l1.fit_predict(l2_data)
        valid_df.loc[l2_mask, "L1_cluster_id"] = l1_sub_labels

    # --- L0 Clustering ---
    print("Performing L0 Clustering...")
    valid_df["L0_cluster_id"] = -1
    for l2_id in range(config.l2_clusters):
        for l1_id in range(config.l1_clusters):
            mask = (valid_df["L2_cluster_id"] == l2_id) & (
                valid_df["L1_cluster_id"] == l1_id
            )
            data = embeddings[mask]

            if len(data) < config.l0_clusters:
                valid_df.loc[mask, "L0_cluster_id"] = 0
                continue

            kmeans_l0 = KMeans(n_clusters=config.l0_clusters, random_state=42)
            l0_sub_labels = kmeans_l0.fit_predict(data)
            valid_df.loc[mask, "L0_cluster_id"] = l0_sub_labels

    # --- Labeling & Embedding Descriptions ---
    print("Generating Labels and Embeddings...")

    # Initialize columns
    for level in ["L2", "L1", "L0"]:
        valid_df[f"{level}_cluster_label"] = ""
        valid_df[f"{level}_cluster_description"] = ""
        valid_df[f"{level}_cluster_description_embedding"] = None

    # L2 Labels
    for l2_id in tqdm(valid_df["L2_cluster_id"].unique(), desc="Labeling L2"):
        mask = valid_df["L2_cluster_id"] == l2_id
        topics = valid_df[mask]["Topic"].sample(min(20, mask.sum())).tolist()
        label, desc = await generate_label(client, topics, "L2", config.model)
        embedding = await embed_text(client, desc)

        valid_df.loc[mask, "L2_cluster_label"] = label
        valid_df.loc[mask, "L2_cluster_description"] = desc
        idxs = valid_df[mask].index
        for idx in idxs:
            valid_df.at[idx, "L2_cluster_description_embedding"] = embedding

    # L1 Labels
    unique_l1 = valid_df[["L2_cluster_id", "L1_cluster_id"]].drop_duplicates()
    for _, row in tqdm(unique_l1.iterrows(), total=len(unique_l1), desc="Labeling L1"):
        l2_id, l1_id = row["L2_cluster_id"], row["L1_cluster_id"]
        mask = (valid_df["L2_cluster_id"] == l2_id) & (
            valid_df["L1_cluster_id"] == l1_id
        )
        topics = valid_df[mask]["Topic"].sample(min(20, mask.sum())).tolist()
        label, desc = await generate_label(client, topics, "L1", config.model)
        embedding = await embed_text(client, desc)

        valid_df.loc[mask, "L1_cluster_label"] = label
        valid_df.loc[mask, "L1_cluster_description"] = desc
        idxs = valid_df[mask].index
        for idx in idxs:
            valid_df.at[idx, "L1_cluster_description_embedding"] = embedding

    # L0 Labels
    unique_l0 = valid_df[
        ["L2_cluster_id", "L1_cluster_id", "L0_cluster_id"]
    ].drop_duplicates()
    for _, row in tqdm(unique_l0.iterrows(), total=len(unique_l0), desc="Labeling L0"):
        l2_id, l1_id, l0_id = (
            row["L2_cluster_id"],
            row["L1_cluster_id"],
            row["L0_cluster_id"],
        )
        mask = (
            (valid_df["L2_cluster_id"] == l2_id)
            & (valid_df["L1_cluster_id"] == l1_id)
            & (valid_df["L0_cluster_id"] == l0_id)
        )
        topics = valid_df[mask]["Topic"].sample(min(20, mask.sum())).tolist()
        label, desc = await generate_label(client, topics, "L0", config.model)
        embedding = await embed_text(client, desc)

        valid_df.loc[mask, "L0_cluster_label"] = label
        valid_df.loc[mask, "L0_cluster_description"] = desc
        idxs = valid_df[mask].index
        for idx in idxs:
            valid_df.at[idx, "L0_cluster_description_embedding"] = embedding

    # Clean up and save
    valid_df.drop(columns=["embedding_vec"], inplace=True)

    # Serialize embeddings
    for level in ["L2", "L1", "L0"]:
        col = f"{level}_cluster_description_embedding"
        valid_df[col] = valid_df[col].apply(
            lambda x: json.dumps(x) if x is not None else "[]"
        )

    print(f"Saving to {output_csv}...")
    valid_df.to_csv(output_csv, index=False)
    print("Done!")


if __name__ == "__main__":
    asyncio.run(
        process_clustering(
            input_csv="selected_conversations_with_topics_embedded.csv",
            output_csv="selected_conversations_with_topics_embedded_clustered.csv",
        )
    )
