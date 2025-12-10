# OpenClio Data Pipeline

This pipeline ingests conversation traces, generates topics, embeds them, clusters them hierarchically, and indexes them into Pinecone for the OpenClio visualizer.

## Prerequisites

1.  **Python 3.10+**
2.  **API Keys** (in `.env` file):
    *   `DEEPSEEK_API_KEY`: For topic generation (or OpenAI if swapped).
    *   `OPENAI_API_KEY`: For embeddings and cluster labeling.
    *   `PINECONE_API_KEY`: For vector storage.
    *   `PINECONE_INDEX_URL`: The host URL of your Pinecone index.

## Installation

```bash
pip install -r requirements.txt
```

## Usage

1.  **Prepare your CSV:**
    Your input CSV should have at least one column containing the conversation text (e.g., `Conversation`).

2.  **Run the Pipeline:**
    Run the `pipeline/run.py` script from the project root.

    ```bash
    python -m pipeline.run --input path/to/your_data.csv --conversation_col "Conversation"
    ```

    This will:
    1.  Generate topics for each conversation (using DeepSeek).
    2.  Embed the topics (using OpenAI).
    3.  Cluster topics into L2 -> L1 -> L0 hierarchies and label them (using OpenAI).
    4.  Upsert everything to your Pinecone index.

## Configuration

You can customize clustering parameters in `pipeline/cluster.py` (e.g., number of clusters per level).

## Output

Intermediate files are saved in the `output/` directory:
*   `step1_topics.csv`: Contains generated topics.
*   `step2_embedded.csv`: Contains topic embeddings.
*   `step3_clustered.csv`: Contains cluster IDs, labels, and descriptions.
