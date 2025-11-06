import { NextRequest } from "next/server";
import { Agent, OpenAIConversationsSession, run } from "@openai/agents";
import { z } from "zod";

const traceAgentSchema = z.object({
    query: z.string(), // For now, the user just sends a query string via the API. Maybe define some more things later on.
});

// Basic API route to return all traces from Pinecone.
export async function POST(request: NextRequest) {
    const body = await request.json();
    const validationResponse = traceAgentSchema.safeParse(body);
    if (!validationResponse.success) {
        return new Response(
            JSON.stringify({ error: "Invalid request body. Please provide a valid query string." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
    }
    console.log(`Request body: ${JSON.stringify(body)}`);

    // Create a ReadableStream for streaming the response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            try {
                // Initializing a new agent and session using the Agents/Conversations SDK.
                const traceAgent = new Agent({
                    name: "traceAgent",
                    instructions: "You are a helpful assistant that helps users uncover hidden insights from traces in Pinecone.", // Edit this, not super verbose/good at all. Later, we also want to add in a new tool for searching traces.
                });
                console.log("Trace agent initialized.");
                const session = new OpenAIConversationsSession();
                console.log("Session initialized.");

                // Run the agent with streaming enabled
                const result = await run(traceAgent, validationResponse.data.query, {
                    session,
                    stream: true,
                });

                // Stream text output as it arrives
                const textStream = result.toTextStream();

                // Read chunks from the text stream and forward them as SSE
                for await (const chunk of textStream) {
                    // Convert chunk to string (handles string, Buffer, Uint8Array, etc.)
                    const chunkStr = typeof chunk === 'string'
                        ? chunk
                        : (chunk as any)?.toString() || String(chunk);
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: chunkStr })}\n\n`));
                }

                // Wait for completion
                await result.completed;

                // Send completion signal
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
                controller.close();
            } catch (error) {
                console.error("Error in streaming:", error);
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ error: "Failed to generate response" })}\n\n`)
                );
                controller.close();
            }
        },
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    });
}