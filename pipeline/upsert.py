import pandas as pd
import json
import os
import ast
from pinecone import Pinecone
from tqdm import tqdm
from dotenv import load_dotenv

load_dotenv()


def upsert_to_pinecone(
    input_csv: str, index_name: str = "openclio", batch_size: int = 100
):
    print(f"Loading {input_csv}...")
    df = pd.read_csv(input_csv)
    df = df.fillna("")

    api_key = os.getenv("PINECONE_API_KEY")
    if not api_key:
        raise ValueError("PINECONE_API_KEY not found")

    pc = Pinecone(api_key=api_key)
    # Assuming the index already exists. If not, we might need to create it.
    # For now, we connect to existing index.
    index = pc.Index(name=index_name, host=os.getenv("PINECONE_INDEX_URL"))

    # --- Upsert Clusters (L2 -> L1 -> L0) ---

    # L2 Clusters
    unique_l2 = (
        df.groupby(
            [
                "L2_cluster_id",
                "L2_cluster_label",
                "L2_cluster_description",
                "L2_cluster_description_embedding",
            ]
        )
        .size()
        .reset_index(name="count")
    )

    l2_vectors = []
    for idx, row in unique_l2.iterrows():
        metadata = {
            "type": "l2_cluster",
            "name": row["L2_cluster_label"],
            "description": row["L2_cluster_description"],
            "trace_count": int(row["count"]),
            "L2_cluster_id": int(row["L2_cluster_id"]),
        }
        values = json.loads(row["L2_cluster_description_embedding"])
        l2_vectors.append(
            {
                "id": f"l2_cluster_{row['L2_cluster_id']}",
                "values": values,
                "metadata": metadata,
            }
        )

    if l2_vectors:
        print(f"Upserting {len(l2_vectors)} L2 clusters...")
        index.upsert(vectors=l2_vectors)

    # L1 Clusters
    unique_l1 = (
        df.groupby(
            [
                "L2_cluster_id",
                "L1_cluster_id",
                "L1_cluster_label",
                "L1_cluster_description",
                "L1_cluster_description_embedding",
            ]
        )
        .size()
        .reset_index(name="count")
    )

    l1_vectors = []
    for idx, row in unique_l1.iterrows():
        metadata = {
            "type": "l1_cluster",
            "name": row["L1_cluster_label"],
            "description": row["L1_cluster_description"],
            "trace_count": int(row["count"]),
            "L1_cluster_id": int(row["L1_cluster_id"]),
            "L2_cluster_id": int(row["L2_cluster_id"]),
        }
        values = json.loads(row["L1_cluster_description_embedding"])
        l1_vectors.append(
            {
                "id": f"l1_cluster_{row['L2_cluster_id']}_{row['L1_cluster_id']}",
                "values": values,
                "metadata": metadata,
            }
        )

    if l1_vectors:
        print(f"Upserting {len(l1_vectors)} L1 clusters...")
        # Batch upsert
        for i in range(0, len(l1_vectors), batch_size):
            index.upsert(vectors=l1_vectors[i : i + batch_size])

    # L0 Clusters
    unique_l0 = (
        df.groupby(
            [
                "L2_cluster_id",
                "L1_cluster_id",
                "L0_cluster_id",
                "L0_cluster_label",
                "L0_cluster_description",
                "L0_cluster_description_embedding",
            ]
        )
        .size()
        .reset_index(name="count")
    )

    l0_vectors = []
    for idx, row in unique_l0.iterrows():
        metadata = {
            "type": "l0_cluster",
            "name": row["L0_cluster_label"],
            "description": row["L0_cluster_description"],
            "trace_count": int(row["count"]),
            "L0_cluster_id": int(row["L0_cluster_id"]),
            "L1_cluster_id": int(row["L1_cluster_id"]),
            "L2_cluster_id": int(row["L2_cluster_id"]),
        }
        values = json.loads(row["L0_cluster_description_embedding"])
        l0_vectors.append(
            {
                "id": f"l0_cluster_{row['L2_cluster_id']}_{row['L1_cluster_id']}_{row['L0_cluster_id']}",
                "values": values,
                "metadata": metadata,
            }
        )

    if l0_vectors:
        print(f"Upserting {len(l0_vectors)} L0 clusters...")
        for i in range(0, len(l0_vectors), batch_size):
            index.upsert(vectors=l0_vectors[i : i + batch_size])

    # --- Upsert Topics ---
    print("Upserting Topics...")
    topic_vectors = []

    for idx, row in tqdm(df.iterrows(), total=len(df)):
        try:
            embedding = json.loads(row["Topic_Embedding"])
            # Ensure metadata doesn't exceed limits. Truncate conversation if needed.
            conversation_text = str(row["Conversation"])
            if len(conversation_text) > 30000:  # Safe limit
                conversation_text = conversation_text[:30000] + "...(truncated)"

            metadata = {
                "type": "topic",
                "text": row["Topic"],
                "conversation": conversation_text,
                "L0_cluster_id": int(row["L0_cluster_id"]),
                "L1_cluster_id": int(row["L1_cluster_id"]),
                "L2_cluster_id": int(row["L2_cluster_id"]),
                # Add other columns dynamically if needed
            }

            topic_vectors.append(
                {"id": f"topic_{idx}", "values": embedding, "metadata": metadata}
            )

            if len(topic_vectors) >= batch_size:
                index.upsert(vectors=topic_vectors)
                topic_vectors = []

        except Exception as e:
            print(f"Error processing row {idx}: {e}")
            continue

    if topic_vectors:
        index.upsert(vectors=topic_vectors)

    print("Done!")


if __name__ == "__main__":
    upsert_to_pinecone(
        input_csv="selected_conversations_with_topics_embedded_clustered.csv"
    )
