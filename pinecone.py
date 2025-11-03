from pinecone import Pinecone
from dotenv import load_dotenv
import os

load_dotenv()  # Loading environment variables from .env file
pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
index = pc.Index(host="openclio")  # Connecting to the OpenClio index


# Cluster, subcluster are both optional & undefined to start.
def search_traces(
    query: str,
    top_k: int = 10,
    cluster: str | None = None,
    subcluster: str | None = None,
) -> list[dict]:
    # Creating dynamic filter based on optional parameters
    filter = {}
    if cluster:
        filter["cluster"] = cluster
    if subcluster:
        filter["subcluster"] = subcluster

    results = index.search(
        namespace="default",  # Default namespace holds all records
        query={
            "top_k": top_k,
            "filter": filter,
        },
    )
    return results
