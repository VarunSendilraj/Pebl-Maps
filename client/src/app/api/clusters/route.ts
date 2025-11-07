import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from "@pinecone-database/pinecone";

// Cluster vector from Pinecone
interface ClusterVector {
  id: string;
  metadata: {
    type: "l0_cluster" | "l1_cluster" | "l2_cluster";
    name: string;
    trace_count?: number;
    L1_cluster_id?: number;
    L2_cluster_id?: number;
    description?: string;
  };
}

// Simple API route to return all cluster vectors from Pinecone (no OpenAI needed)
export async function GET(request: NextRequest) {
  console.log("🔵 GET /api/clusters - Request received");
  try {
    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is not set");
    }
    console.log("✅ PINECONE_API_KEY found, connecting to Pinecone...");

    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // Use a zero vector for querying (dimension for text-embedding-3-large is 3072)
    // This allows us to fetch clusters without needing OpenAI embeddings
    const dimension = 3072;
    const zeroVector = new Array(dimension).fill(0);

    console.log("🔍 Querying Pinecone index 'openclio' for ALL clusters...");
    // Pinecone allows up to 10,000 results per query. If you have more, we'd need pagination.
    // Note: We query without filter and filter client-side to ensure compatibility
    const result = await pc.Index("openclio").query({
      vector: zeroVector,
      topK: 10000, // Fetch all clusters (max 10,000 per query)
      includeMetadata: true,
    });
    console.log(`✅ Query completed. Found ${result.matches.length} cluster matches.`);

    // Map matches to ClusterVector format, filtering out non-cluster types as safety measure
    const clusters: ClusterVector[] = result.matches
      .filter((match) => {
        const type = match.metadata?.type;
        return type === "l0_cluster" || type === "l1_cluster" || type === "l2_cluster";
      })
      .map((match) => {
        const metadata = match.metadata;
        if (!metadata) {
          throw new Error(`Metadata is undefined for vector ${match.id}`);
        }
        
        const type = metadata.type as "l0_cluster" | "l1_cluster" | "l2_cluster";
        if (!metadata.name || typeof metadata.name !== 'string') {
          throw new Error(`Metadata name is missing or invalid for vector ${match.id}`);
        }

        return {
          id: match.id,
          metadata: {
            type,
            name: metadata.name,
            trace_count: typeof metadata.trace_count === 'number' ? metadata.trace_count : undefined,
            L1_cluster_id: typeof metadata.L1_cluster_id === 'number' ? metadata.L1_cluster_id : undefined,
            L2_cluster_id: typeof metadata.L2_cluster_id === 'number' ? metadata.L2_cluster_id : undefined,
            description: typeof metadata.description === 'string' ? metadata.description : undefined,
          },
        };
      });

    console.log(`📊 Processed ${clusters.length} clusters (L2: ${clusters.filter(c => c.metadata.type === 'l2_cluster').length}, L1: ${clusters.filter(c => c.metadata.type === 'l1_cluster').length}, L0: ${clusters.filter(c => c.metadata.type === 'l0_cluster').length})`);

    return NextResponse.json({ success: true, clusters });
  } catch (error) {
    console.error('Pinecone query error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

