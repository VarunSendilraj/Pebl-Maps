# OpenClio Frontend

The web interface for OpenClio — an interactive visualization for exploring LLM conversation traces.

## Tech Stack

- **[Next.js 14](https://nextjs.org/)** — React framework with App Router
- **[TypeScript](https://www.typescriptlang.org/)** — Type safety
- **[Tailwind CSS](https://tailwindcss.com/)** — Utility-first styling
- **[D3.js](https://d3js.org/)** — Circle packing visualization
- **[Pinecone](https://www.pinecone.io/)** — Vector database queries

## Getting Started

### Prerequisites

- Node.js 18+
- A configured Pinecone index with OpenClio data (run the pipeline first)

### Installation

```bash
npm install
```

### Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your API keys:

```env
PINECONE_API_KEY=your-pinecone-key
OPENAI_API_KEY=your-openai-key
ANTHROPIC_API_KEY=your-anthropic-key  # Optional, for chat agent
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
npm start
```

## Project Structure

```
src/
├── app/
│   ├── api/              # API routes
│   │   ├── chat/         # AI chat agent endpoint
│   │   ├── clusters/     # Cluster data endpoint
│   │   ├── topics/       # Topics endpoint
│   │   ├── trace/        # Individual trace endpoint
│   │   └── prefetch/     # Prefetch optimization
│   ├── layout.tsx        # Root layout
│   └── page.tsx          # Main page
├── components/
│   ├── bubbles/          # Bubble visualization
│   │   ├── BubbleCanvas.tsx
│   │   └── Breadcrumb.tsx
│   ├── cluster-tree/     # Tree navigation sidebar
│   ├── sidebar/          # Sidebar components
│   ├── TraceViewer.tsx   # Conversation viewer
│   └── TraceAgent.tsx    # AI chat interface
├── contexts/             # React contexts
│   ├── NavigationContext.tsx
│   ├── TabsContext.tsx
│   ├── TraceContext.tsx
│   └── UIContext.tsx
├── lib/
│   └── bubbles/          # Visualization utilities
│       ├── api.ts        # API client
│       ├── colors.ts     # Color schemes
│       ├── transform.ts  # Data transformations
│       └── types.ts      # TypeScript types
└── styles/
    └── globals.css       # Global styles
```

## Key Components

### BubbleCanvas

The main visualization component using D3's circle packing algorithm. Features:
- Hierarchical cluster visualization (L2 → L1 → L0)
- Click to zoom into clusters
- Hover tooltips with trace counts
- Color-coded by L2 category

### ClusterTree

A collapsible tree view showing the cluster hierarchy:
- Expand/collapse nodes
- Click to navigate and sync with canvas
- Shows trace counts at each level

### TraceViewer

Displays individual conversation traces:
- User and assistant message threading
- Metadata display (model, timestamp, etc.)
- Topic summary

### TraceAgent

AI-powered chat interface for querying traces:
- Natural language questions about your data
- Powered by Claude or GPT-4

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/clusters` | GET | Fetch all cluster hierarchy data |
| `/api/topics` | GET | Fetch topics for a specific L0 cluster |
| `/api/trace` | GET | Fetch a single trace by ID |
| `/api/chat` | POST | Chat with AI agent about traces |
| `/api/prefetch` | GET | Prefetch trace data for performance |

## Styling

The app uses a warm, paper-like color palette:
- Background: `#f0f0eb` (warm off-white)
- Sidebar: `#e5e0d8` (warm beige)
- Each L2 cluster has a unique color from `lib/bubbles/colors.ts`

## License

MIT — See the root [LICENSE](../LICENSE) file.
