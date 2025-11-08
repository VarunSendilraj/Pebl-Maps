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

    // Extract base topicId - handle both formats:
    // - Base ID: "topic_109" -> "topic_109"
    // - Chunk ID: "topic_109_0" -> "topic_109"
    // Use same logic as topics route for consistency
    const baseIdMatch = traceId.match(/^(topic_\d+)/);
    const topicId = baseIdMatch && baseIdMatch[1] ? baseIdMatch[1] : traceId.substring(0, traceId.lastIndexOf("_"));
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

    // Collect all trace chunks - trace is now stored as an array of strings
    let traceMessages: string[] = [];
    let totalTraceChunks = 0;
    let i = 0; // Increment this until a chunk index is nonexistent. This is the chunk index.
    
    while (true) {
        const chunkId = `${topicId}_${i}`;
        const chunk = await pc.Index("openclio").fetch([chunkId]);
        if (chunk.records && chunk.records[chunkId]) {
            const metadata = chunk.records[chunkId].metadata;
            
            if (i === 0) {
                // Extract metadata from first chunk
                traceChunk.l0_cluster_id = Number(metadata?.L0_cluster_id ?? 0);
                traceChunk.l1_cluster_id = Number(metadata?.L1_cluster_id ?? 0);
                traceChunk.l2_cluster_id = Number(metadata?.L2_cluster_id ?? 0);
                traceChunk.country = String(metadata?.country ?? "");
                traceChunk.description = String(metadata?.description ?? "");
                traceChunk.hour = Number(metadata?.hour ?? 0);
                traceChunk.model = String(metadata?.model ?? "");
                traceChunk.state = String(metadata?.state ?? "");
                totalTraceChunks = Number(metadata?.total_trace_chunks ?? 0);
            }
            
            // Extract trace array from metadata
            const traceData = metadata?.trace;
            if (Array.isArray(traceData)) {
                // New format: trace is an array of strings
                traceMessages = traceMessages.concat(traceData);
            } else {
                // Fallback: if trace is not an array, log warning and skip
                console.warn(`Chunk ${chunkId} has non-array trace data, skipping`);
            }
        } else {
            break;
        }
        i++;
    }

    // Optional validation: check if we fetched all expected chunks
    if (totalTraceChunks > 0 && i !== totalTraceChunks) {
        console.warn(`Expected ${totalTraceChunks} chunks but found ${i} chunks for topic ${topicId}`);
    }

    // Convert flat array to turns format
    // traceMessages is a flat array: [user_msg_1, assistant_msg_1, user_msg_2, assistant_msg_2, ...]
    // We need to convert it to: [{user: "...", assistant: "..."}, ...]
    let turns: Array<{ user: string; assistant: string }> = [];
    
    if (traceMessages.length === 0) {
        console.warn(`No trace messages found for topic ${topicId}`);
    } else {
        // Pair messages: even indices are user messages, odd indices are assistant messages
        for (let j = 0; j < traceMessages.length; j += 2) {
            turns.push({
                user: traceMessages[j] || "",
                assistant: traceMessages[j + 1] || ""  // Handle odd-length arrays
            });
        }
    }
    
    traceChunk.num_turns = turns.length;

    // console.log(`\n${'='.repeat(80)}`);
    // console.log(`TRACE PARSED - Topic ID: ${topicId}`);
    // console.log(`${'='.repeat(80)}`);
    // console.log(`Processed ${i} chunks | Total turns: ${turns.length}`);
    // console.log(`Description: ${traceChunk.description}`);
    // console.log(`Metadata: L0=${traceChunk.l0_cluster_id}, L1=${traceChunk.l1_cluster_id}, L2=${traceChunk.l2_cluster_id}`);
    // console.log(`${'='.repeat(80)}\n`);

    // Print each turn with clear separations
    turns.forEach((turn, index) => {
        console.log(`\n${'-'.repeat(80)}`);
        console.log(`TURN ${index + 1} / ${turns.length}`);
        console.log(`${'-'.repeat(80)}`);
        
        console.log(`\n👤 USER:`);
        console.log(`${'─'.repeat(40)}`);
        console.log(turn.user || '(empty)');
        
        console.log(`\n🤖 ASSISTANT:`);
        console.log(`${'─'.repeat(40)}`);
        console.log(turn.assistant || '(empty)');
    });

    console.log(`\n${'='.repeat(80)}`);
    console.log(`END OF TRACE - ${turns.length} turns displayed`);
    console.log(`${'='.repeat(80)}\n`);

    return NextResponse.json({
        success: true,
        trace: {
            turns: turns,
            metadata: traceChunk,
        },
    });
}