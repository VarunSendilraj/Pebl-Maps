# Pebl Maps

This is part of a larger project called Pebl. Pebl is an open source project to help teams stop iterating on vibes and start iterating on evidence. To learn more check out [the website](https://www.usepebl.com).

**The Goal of Pebl Maps**

Pebl maps helps you understand how your users interact with your agents. This is done by automatically clustering and visualizing conversation traces and allowing you to investigate issues by drilling down infinitely into individual conversations. To pinpoint more specific issues and get more detailed answers, you can chat with an agent that is deeply understands your data.

To get started, upload your traces, and Pebl maps will generate topics, organize them into a hierarchical structure, and provide an interactive visualization to explore patterns in your data.

![OpenClio Screenshot](https://www.usepebl.com/_next/image?url=%2Flanding-page-img.png&w=3840&q=75)

## Features

- **Automatic Topic Generation** — Uses LLMs to summarize each conversation trace
- **Hierarchical Clustering** — Organizes traces into hierarchical clusters (broad categories)
- **Interactive Bubble Visualization** — Explore clusters with a zoomable, color-coded canvas
- **Trace Viewer** — Drill down infinitely into individual conversations
- **AI-Powered Analysis** — Chat with an AI agent to ask questions about your traces and get answers from your traces

* Note: Agent mode is currently unavailable, but will be coming soon!

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- API Keys:
  - [OpenAI](https://platform.openai.com/api-keys) (for embeddings & cluster labeling)
  - [DeepSeek](https://platform.deepseek.com/) (for topic generation) — *or use OpenAI*
  - [Pinecone](https://www.pinecone.io/) (for vector storage)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/OpenClio.git
cd pebl-maps

# Install Python dependencies
pip install -r requirements.txt

# Install frontend dependencies
cd client
npm install
cd ..
```

### 2. Configure Environment

```bash
# Copy the example env files
cp .env.example .env
cp client/.env.example client/.env.local

# Edit .env and add your API keys
```

### 3. Prepare Your Data

Your input CSV should have a column containing conversation text. The expected format is a dictionary of turns:

```python
# Example conversation format
{
  1: {"user": "Hello, how are you?", "assistant": "I'm doing well, thanks!"},
  2: {"user": "What's the weather?", "assistant": "I don't have access to weather data."}
}
```

### 4. Run the Pipeline

```bash
python -m pipeline.run --input your_traces.csv --conversation_col "Conversation"
```

This will:
1. Generate topic summaries for each conversation
2. Create embeddings using OpenAI
3. Cluster topics hierarchically (L2 → L1 → L0)
4. Index everything into Pinecone

### 5. Start the Frontend

```bash
cd client
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to explore your traces!

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         OpenClio                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Pipeline   │───▶│   Pinecone   │◀───│   Frontend   │       │
│  │              │    │   (Vectors)  │    │   (Next.js)  │       │
│  └──────────────┘    └──────────────┘    └──────────────┘       │
│         │                                       │                │
│         ▼                                       ▼                │
│  ┌──────────────┐                       ┌──────────────┐        │
│  │  OpenAI /    │                       │  Bubble      │        │
│  │  DeepSeek    │                       │  Canvas      │        │
│  │  (LLM APIs)  │                       │  + TreeView  │        │
│  └──────────────┘                       └──────────────┘        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Pipeline (`pipeline/`)

| Step | Script | Description |
|------|--------|-------------|
| 1 | `generate_topics.py` | Summarizes each conversation using an LLM |
| 2 | `embed_topics.py` | Creates vector embeddings for topics |
| 3 | `cluster.py` | Performs hierarchical K-means clustering |
| 4 | `upsert.py` | Indexes clusters and topics into Pinecone |

### Frontend (`client/`)

- **Next.js 14** with App Router
- **D3.js** for bubble/circle packing visualization
- **Tailwind CSS** for styling
- Interactive cluster tree navigation
- Trace viewer with conversation replay

## Configuration

### Pipeline Options

```bash
python -m pipeline.run --help

Options:
  --input              Input CSV file path (required)
  --output_dir         Directory for intermediate files (default: ./output)
  --conversation_col   Column name for conversation text (default: Conversation)
  --skip_generation    Skip topic generation step
  --skip_embedding     Skip embedding step
  --skip_clustering    Skip clustering step
```

### Clustering Parameters

Edit `pipeline/cluster.py` to customize:

```python
@dataclass
class ClusterConfig:
    l2_clusters: int = 5   # Number of top-level categories
    l1_clusters: int = 5   # Sub-categories per L2
    l0_clusters: int = 5   # Topics per L1
    model: str = "gpt-4o"  # Model for labeling
```

## Project Structure

```
OpenClio/
├── client/                 # Next.js frontend
│   ├── src/
│   │   ├── app/           # App router pages & API routes
│   │   ├── components/    # React components
│   │   ├── contexts/      # React contexts
│   │   └── lib/           # Utilities & types
│   └── ...
├── pipeline/              # Data ingestion pipeline
│   ├── run.py             # Main entry point
│   ├── generate_topics.py # Topic generation
│   ├── embed_topics.py    # Embedding creation
│   ├── cluster.py         # Hierarchical clustering
│   └── upsert.py          # Pinecone indexing
├── .env.example           # Environment template
├── requirements.txt       # Python dependencies
└── README.md
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Built with [Next.js](https://nextjs.org/), [D3.js](https://d3js.org/), and [Pinecone](https://www.pinecone.io/)
- Inspired by the need to understand LLM application usage at scale
