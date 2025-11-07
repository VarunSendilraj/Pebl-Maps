import { NextRequest, NextResponse } from "next/server";
import { Pinecone } from "@pinecone-database/pinecone";

interface Trace {
    turns: Array<{ user: string; assistant: string }>,
    metadata: TraceMetadata,
}

interface TraceMetadata {
    traceId: string,
    l0_cluster_id: number,
    l1_cluster_id: number,
    l2_cluster_id: number,
    country: string,
    description: string,
    hour: number,
    model: string,
    state: string,
    toxic: boolean,
    num_turns: number,
}

// API route that returns a TraceChunkData object for a given traceId (passed in as a searchParam with the getter).
export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const traceId = searchParams.get("traceId");
    if (!traceId) {
        return NextResponse.json({ error: "traceId is required" }, { status: 400 });
    }
    if (!process.env.PINECONE_API_KEY) {
        return NextResponse.json({ error: "PINECONE_API_KEY is not set" }, { status: 500 });
    }

    // Initializing the Pinecone client.
    const pc = new Pinecone({
        apiKey: process.env.PINECONE_API_KEY,
    });

    // `traceId` is formatted as `topic_id_{chunk_no}`. We want to remove chunk_no from this.
    const topicId = traceId.substring(0, traceId.lastIndexOf("_"));
    console.log(`Extracted base topicId: ${topicId} from traceId: ${traceId}`);

    // Initialize a new TraceChunkData object.
    let traceChunk: TraceMetadata = {
        traceId: topicId,
        l0_cluster_id: 0,
        l1_cluster_id: 0,
        l2_cluster_id: 0,
        country: "",
        description: "",
        hour: 0,
        model: "",
        state: "",
        toxic: false,
        num_turns: 0,
    };

    let i = 0; // Increment this until a chunk index is is nonexistent. This is the chunk index.
    let content = "";
    while (true) {
        const chunkId = `${topicId}_${i}`;
        const chunk = await pc.Index("openclio").fetch([chunkId]);
        if (chunk.records && chunk.records[chunkId]) {
            if (i == 0) {
                traceChunk.l0_cluster_id = Number(chunk.records[chunkId]?.metadata?.L0_cluster_id ?? 0);
                traceChunk.l1_cluster_id = Number(chunk.records[chunkId]?.metadata?.L1_cluster_id ?? 0);
                traceChunk.l2_cluster_id = Number(chunk.records[chunkId]?.metadata?.L2_cluster_id ?? 0);
                traceChunk.country = String(chunk.records[chunkId]?.metadata?.country ?? "");
                traceChunk.description = String(chunk.records[chunkId]?.metadata?.description ?? "");
                traceChunk.hour = Number(chunk.records[chunkId]?.metadata?.hour ?? 0);
                traceChunk.model = String(chunk.records[chunkId]?.metadata?.model ?? "");
                traceChunk.state = String(chunk.records[chunkId]?.metadata?.state ?? "");
                content += String(chunk.records[chunkId]?.metadata?.trace ?? "");
                // console.log(chunk.records[chunkId]?.metadata);
            } else {
                content += String(chunk.records[chunkId]?.metadata?.trace ?? "");
            }
        } else {
            break;
        }
        i++;
    }

    // At this point, `content` contains the full text of the trace, as a string. Now we need to parse it into a JSON object.
    content = content.trim();

    // Remove defaultdict wrapper: "defaultdict(<class 'dict'>, {...})"
    content = content.replace(/^defaultdict\([^,]+,\s*/, '');
    content = content.replace(/\)$/, '');
    console.log(`Content after removing defaultdict wrapper: ${content}`);

    // Extract JSON object from defaultdict string using regex
    // Pattern matches content between outermost braces
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        return NextResponse.json({ error: "Failed to extract JSON from content" }, { status: 500 });
    }

    let jsonString = jsonMatch[0];

    // Convert Python dict format to valid JSON:
    // 1. Replace numeric keys (e.g., "102283:") with quoted keys (e.g., "\"102283\":")
    // 2. Replace single quotes with double quotes for string values
    jsonString = jsonString.replace(/(\d+):/g, '"$1":');
    // Replace all \' with a placeholder, then convert outer single quotes to double quotes, then revert placeholder to single quote
    jsonString = jsonString.replace(/\\'/g, '___SINGLE_QUOTE_PLACEHOLDER___');
    jsonString = jsonString.replace(/'/g, '"');
    jsonString = jsonString.replace(/___SINGLE_QUOTE_PLACEHOLDER___/g, "'");

    // Escape double-quotes inside user or assistant string values to prevent invalid JSON parsing
    // This works directly on jsonString before parsing, but after Python->JSON conversions above
    // We'll use a regex to match "user": "VALUE" and "assistant": "VALUE"
    jsonString = jsonString.replace(
        /("(user|assistant)"\s*:\s*")((?:[^"\\]|\\.)*)(")/g,
        function (match, prefix, field, value, suffix) {
            // Escape unescaped double quotes within the value string
            // Only escape " that are not already preceded by \ (not escaped yet)
            // In this context, since original data may have unescaped " from Python, we escape all
            // unescaped " inside the value, but skipping structural quotes
            console.log(`prefix: ${prefix}`);
            console.log(`value: ${value}`);
            console.log(`suffix: ${suffix}`);
            const escapedValue = value.replace(/(?<!\\)"/g, '\\"');
            return prefix + escapedValue + suffix;
        }
    );

    let turns: Array<{ user: string; assistant: string }> = [];
    try {
        console.log(`JSON string: ${jsonString}`);
        const parsed = JSON.parse(jsonString);
        // Convert object to array of turns
        turns = Object.values(parsed) as Array<{ user: string; assistant: string }>;
        traceChunk.num_turns = turns.length;
    } catch (error) {
        console.error("Failed to parse JSON:", error);
        return NextResponse.json({ error: "Failed to parse trace content" }, { status: 500 });
    }

    console.log(`Processed ${i} chunks for topic ${topicId}`);
    console.log(`Number of turns: ${turns.length}`);

    return NextResponse.json({
        success: true,
        trace: {
            turns: turns,
            metadata: traceChunk,
        },
    });
}