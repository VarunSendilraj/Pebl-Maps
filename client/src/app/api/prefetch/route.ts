import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";
import type { Trace, Cluster, Cache } from "./searchUtils";

// API route to prefetch all traces from the OpenClio index (~1k entries).
export async function GET(request: NextRequest) {
    try {
        if (!process.env.PINECONE_API_KEY) {
            return NextResponse.json(
                { error: "PINECONE_API_KEY is not set" },
                { status: 500 }
            );
        }

        const pc = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });


        // Getting all trace results
        const traceResult = await pc.Index("openclio").query({
            vector: new Array(3072).fill(0), // Querying with the zero vector returns all trace results.
            topK: 10000,
            includeMetadata: true,
            filter: {
                type: "topic",
            },
        });
        const traces = traceResult.matches.map(match => ({
            id: String(match.id),
            description: String(match.metadata?.description),
            trace: String(match.metadata?.trace),
        })) as Trace[]; // Creates a Trace[] object.

        // Getting all cluster results
        const clusterResult = await pc.Index("openclio").query({
            vector: new Array(3072).fill(0), // Querying with the zero vector returns all cluster results.
            topK: 10000,
            includeMetadata: true,
            filter: {
                type: {
                    $in: ["l1_cluster", "l2_cluster", "l0_cluster"],
                },
            },
        });
        const l0Clusters = clusterResult.matches.filter(match => match.metadata?.type === "l0_cluster").map(match => ({
            id: String(match.id),
            name: String(match.metadata?.name),
            description: String(match.metadata?.description),
            l2ClusterId: typeof match.metadata?.L2_cluster_id === 'number' ? match.metadata.L2_cluster_id : undefined,
        })) as Cluster[]; // Creates a Cluster[] object.
        const l1Clusters = clusterResult.matches.filter(match => match.metadata?.type === "l1_cluster").map(match => ({
            id: String(match.id),
            name: String(match.metadata?.name),
            description: String(match.metadata?.description),
            l2ClusterId: typeof match.metadata?.L2_cluster_id === 'number' ? match.metadata.L2_cluster_id : undefined,
        })) as Cluster[]; // Creates a Cluster[] object.
        const l2Clusters = clusterResult.matches.filter(match => match.metadata?.type === "l2_cluster").map(match => {
            // For L2 clusters, extract the L2_cluster_id from metadata or ID
            let l2ClusterId: number | undefined = typeof match.metadata?.L2_cluster_id === 'number' ? match.metadata.L2_cluster_id : undefined;
            if (l2ClusterId === undefined) {
                // Try to extract from ID like "l2_cluster_3" or "l2-3"
                const idMatch = match.id.match(/(?:l2[_-]?cluster[_-]?|l2[_-])(\d+)/i);
                l2ClusterId = idMatch ? parseInt(idMatch[1] ?? "", 10) : undefined;
                if (isNaN(l2ClusterId ?? 0)) {
                    l2ClusterId = undefined;
                }
            }
            return {
                id: String(match.id),
                name: String(match.metadata?.name),
                description: String(match.metadata?.description),
                l2ClusterId,
            };
        }) as Cluster[]; // Creates a Cluster[] object.

        const cache: Cache = {
            traces: traces,
            l0Clusters: l0Clusters,
            l1Clusters: l1Clusters,
            l2Clusters: l2Clusters,
        };
        return NextResponse.json(cache);
    } catch (error) {
        console.error("Error fetching traces:", error);
        return NextResponse.json(
            { error: "Failed to fetch traces" },
            { status: 500 }
        );
    }
}
