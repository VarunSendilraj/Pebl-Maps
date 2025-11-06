# Tools for the OpenClio agent.
from pinecone import Pinecone
from dotenv import load_dotenv
import os

load_dotenv()  # Loading environment variables from .env file
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(name="openclio", host=os.getenv("PINECONE_INDEX_URL"))  # Connecting to the OpenClio index


def search_traces(
    query: str,
    top_k: int = 10,
    cluster: str | None = None,
    subcluster: str | None = None,
) -> list[dict]:
    """
    Semantically searches against trace embeddings.
    Answers questions like: "show me a trace where a user was angry about flight cancellation?"

    Args:
        query: Semantic search query string
        top_k: Number of results to return (default: 10)
        cluster: Optional cluster name to filter by
        subcluster: Optional subcluster name to filter by

    Returns:
        List of trace results matching the query
    """
    # Creating dynamic filter based on optional parameters
    filter = {"type": "trace"}
    if cluster:
        filter["cluster"] = cluster
    if subcluster:
        filter["subcluster"] = subcluster

    results = index.search(
        namespace="default",  # Default namespace holds all records
        query={
            "inputs": {"text": query},
            "top_k": top_k,
            "filter": filter,
        },
    )
    return results[
        "result"
    ][
        "hits"
    ]  # Note: not sure if this is the right way to return, need to debug after Varun's push


def search_clusters(
    query: str,
    top_k: int = 10,
) -> list[dict]:
    """
    Semantically searches against cluster embeddings.
    Answers questions like: "what are the main topics that people care about?"

    Args:
        query: Semantic search query string
        top_k: Number of results to return (default: 10)

    Returns:
        List of cluster results matching the query
    """
    filter = {"type": "cluster"}

    results = index.search(
        namespace="default",
        query={
            "inputs": {"text": query},
            "top_k": top_k,
            "filter": filter,
        },
    )
    return results["result"]["hits"]


def search_subclusters(
    query: str,
    cluster: str | None = None,
    top_k: int = 10,
) -> list[dict]:
    """
    Semantically searches against subcluster embeddings.
    Answers questions like: "tell me more about {x} issues" (where x is the subcluster).

    Args:
        query: Semantic search query string
        cluster: Optional cluster name to filter by
        top_k: Number of results to return (default: 10)

    Returns:
        List of subcluster results matching the query
    """
    filter = {"type": "subcluster"}
    if cluster:
        filter["cluster"] = cluster

    results = index.search(
        namespace="default",
        query={
            "inputs": {"text": query},
            "top_k": top_k,
            "filter": filter,
        },
    )
    return results["result"]["hits"]
