from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import uvicorn
from fastapi.middleware.cors import CORSMiddleware
from tools import search_traces, search_topics

app = FastAPI(title="OpenClio Backend", description="API for OpenClio tools")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Default Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = 10
    cluster: Optional[str] = None
    subcluster: Optional[str] = None

class TopicRequest(BaseModel):
    query: str
    top_k: Optional[int] = 10

@app.post("/search_traces")
async def api_search_traces(request: SearchRequest):
    try:
        results = search_traces(
            query=request.query,
            top_k=request.top_k,
            cluster=request.cluster,
            subcluster=request.subcluster
        )
        return {"hits": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/search_topics")
async def api_search_topics(request: TopicRequest):
    try:
        # Modify the search_traces function to filter for topics
        results = search_traces(
            query=request.query,
            top_k=request.top_k
        )
        
        # Filter to only include traces with type="topic"
        topic_results = []
        for hit in results:
            # Check if type is in metadata (the format may vary)
            if hit.get('metadata', {}).get('type') == 'topic':
                topic_results.append(hit)
        
        return {"hits": topic_results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)