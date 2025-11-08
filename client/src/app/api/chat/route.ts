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

// Basic API route to chat with the trace agent. Returns a stream of events.
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
                    session: session as any,
                    stream: true,
                });

                // Process events in a single iteration to extract both tool calls and text
                // This avoids the "stream locked" issue by reading the stream only once
                console.log("[DEBUG] Starting to process events...");
                let chunkCount = 0;

                // Iterate directly over the result object to get all events
                for await (const event of result as any) {
                    // Extract tool calls from run_item_stream_event
                    if (event.type === 'run_item_stream_event' && event.name === 'tool_called') {
                        console.log(`[DEBUG] Tool called event detected`);
                        console.log(`[DEBUG] Full event:`, JSON.stringify(event, null, 2));
                        
                        const rawItem = event.item?.rawItem;
                        if (rawItem && rawItem.name) {
                            const toolName = rawItem.name;
                            const toolArguments = rawItem.arguments ? JSON.parse(rawItem.arguments) : {};
                            
                            console.log(`[DEBUG] Tool name: ${toolName}`);
                            console.log(`[DEBUG] Tool arguments:`, toolArguments);
                            
                            // Stream tool call event to frontend
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ 
                                type: 'tool_call', 
                                toolName: toolName,
                                toolArguments: toolArguments
                            })}\n\n`));
                        }
                    }

                    // Extract text from raw_model_stream_event
                    if (event.type === 'raw_model_stream_event') {
                        console.log(`[DEBUG] Raw model stream event detected, event data:`, event.data);
                        const eventData = event.event || event.data;
                        
                        // Check for response.completed with text
                        if (eventData?.type === 'response.completed' && eventData?.response?.text) {
                            const textContent = eventData.response.text;
                            
                            // text can be an object with content array or a string
                            let textToStream = '';
                            if (typeof textContent === 'string') {
                                textToStream = textContent;
                            } else if (textContent?.content && Array.isArray(textContent.content)) {
                                // Extract text from content array
                                textToStream = textContent.content
                                    .map((item: any) => {
                                        if (typeof item === 'string') return item;
                                        if (item?.text) return item.text;
                                        if (item?.content) return item.content;
                                        return '';
                                    })
                                    .filter(Boolean)
                                    .join('');
                            } else if (textContent?.text) {
                                textToStream = textContent.text;
                            }
                            
                            if (textToStream) {
                                chunkCount++;
                                console.log(`[DEBUG] Text from response.completed (length: ${textToStream.length}):`, textToStream.substring(0, 100) + (textToStream.length > 100 ? '...' : ''));
                                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: textToStream })}\n\n`));
                            }
                        }
                        
                        // Also check for streaming text chunks (delta events)
                        if (eventData?.type === 'response.delta' || eventData?.delta) {
                            const delta = eventData.delta || eventData;
                            if (delta?.text) {
                                let textChunk = '';
                                if (typeof delta.text === 'string') {
                                    textChunk = delta.text;
                                } else if (delta.text?.content) {
                                    textChunk = delta.text.content;
                                } else if (delta.text?.delta) {
                                    textChunk = delta.text.delta;
                                }
                                
                                if (textChunk) {
                                    chunkCount++;
                                    console.log(`[DEBUG] Text chunk #${chunkCount} (delta, length: ${textChunk.length}):`, textChunk.substring(0, 100) + (textChunk.length > 100 ? '...' : ''));
                                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: textChunk })}\n\n`));
                                }
                            }
                        }
                    }
                }

                console.log(`[DEBUG] Event processing completed. Total text chunks: ${chunkCount}`);

                // Wait for completion if the property exists
                if ((result as any).completed) {
                    await (result as any).completed;
                }

                // Send completion signal with conversationId for session persistence
                const conversationId = typeof session === 'string' ? session : (session as any).conversationId;
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({
                    done: true,
                    conversationId: conversationId
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