import { NextRequest, NextResponse } from "next/server";
import { Agent, OpenAIConversationsSession, run } from "@openai/agents";
import { z } from "zod";
import { searchTracesTool, getTraceByIdTool } from "./tool";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

const traceAgentSchema = z.object({
    query: z.string(), // For now, the user just sends a query string via the API. Maybe define some more things later on.
    conversationId: z.string().optional(), // Optional conversation ID for session persistence
});

// Load prompts from YAML file
const promptsPath = join(process.cwd(), "src/app/api/chat/prompts.yaml");
const promptsFile = readFileSync(promptsPath, "utf-8");
const prompts = parse(promptsFile) as { traceAgent: { instructions: string } };

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
                    instructions: prompts.traceAgent.instructions,
                    tools: [searchTracesTool, getTraceByIdTool],
                });
                console.log("Trace agent initialized.");
                // Initialize session with existing conversationId if provided, otherwise create new

                const session = validationResponse.data.conversationId
                    ? validationResponse.data.conversationId
                    : new OpenAIConversationsSession();

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

                // Send completion signal with conversationId for session persistence
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    done: true,
                    conversationId: session.conversationId
                })}\n\n`));
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