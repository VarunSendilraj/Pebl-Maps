import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";

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

        const result = await pc.Index("openclio").query({
            vector: new Array(3072).fill(0), // Querying with the zero vector returns all trace results.
            topK: 10000,
            includeMetadata: true,
            filter: {
                type: "topic",
            },
        });

        const traces = result.matches.map(match => ({
            id: String(match.id),
            description: String(match.metadata?.description),
            trace: String(match.metadata?.trace),
        }));

        return NextResponse.json({
            success: true,
            traces: traces, // Return traces to client so they can populate the client-side MiniSearch
        });
    } catch (error) {
        console.error("Error fetching traces:", error);
        return NextResponse.json(
            { error: "Failed to fetch traces" },
            { status: 500 }
        );
    }
}
