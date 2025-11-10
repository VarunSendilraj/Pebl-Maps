import { NextRequest, NextResponse } from "next/server";
import { Agent, OpenAIConversationsSession, run } from "@openai/agents";
import { z } from "zod";
import { searchTracesTool, getTraceByIdTool } from "./tool";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";

const traceAgentSchema = z.object({
    query: z.string(), // For now, the user just sends a query string via the API. Maybe define some more things later on.
    mode: z.enum(["ask", "agent"]).optional().default("ask"), // Mode: "ask" for regular agent, "agent" for test output
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
    const mode = validationResponse.data.mode || "ask";

    // If agent mode, return predefined demo output
    if (mode === "agent") {
        const encoder = new TextEncoder();
        const initialMessage = "I'll set up an evaluation for NSFW Content Detection. This will monitor and analyze potential NSFW Content in the system.";
        const evalCardFormat = '\n<eval_name="NSFW Content Detection" status="active">';
        
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    // Wait 1 second before starting to stream
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    
                    // Stream the initial message word by word to match ask mode behavior
                    const words = initialMessage.split(' ');
                    for (let i = 0; i < words.length; i++) {
                        const word = words[i];
                        const chunk = i === 0 ? word : ' ' + word;
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: chunk })}\n\n`));
                        // Small delay to simulate streaming (similar to ask mode)
                        await new Promise(resolve => setTimeout(resolve, 50));
                    }
                    
                    // Wait 1.5 seconds before showing the eval card
                    await new Promise(resolve => setTimeout(resolve, 1500));
                    
                    // Stream the eval card format as a single chunk (matching ask mode behavior)
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: evalCardFormat })}\n\n`));
                    
                    // Send completion signal
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                        done: true,
                        conversationId: validationResponse.data.conversationId || null
                    })}\n\n`));
                    controller.close();
                } catch (error) {
                    console.error("Error in demo streaming:", error);
                    controller.enqueue(
                        encoder.encode(`data: ${JSON.stringify({ error: "Failed to generate demo response" })}\n\n`)
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

    // Create a ReadableStream for streaming the response (ask mode)
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