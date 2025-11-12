import { NextRequest, NextResponse } from "next/server";
import { Agent, OpenAIConversationsSession, run } from "@openai/agents";
import { z } from "zod";
import { searchTracesTool, getTraceByIdTool } from "./tool";
import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "yaml";
import * as ai from "ai";
import { openai } from "@ai-sdk/openai";
import { wrapAISDK } from "langsmith/experimental/vercel";
import { stepCountIs } from "ai";

// Ensuring that traces are to logged to LangSmith.
const { streamText } = wrapAISDK(ai);

const traceAgentSchema = z.object({
    query: z.string(), // For now, the user just sends a query string via the API. Maybe define some more things later on.
    mode: z.enum(["ask", "agent"]).optional().default("ask"), // Mode: "ask" for regular agent, "agent" for test output
    conversationId: z.string().optional(), // Optional conversation ID for session persistence
});

// Load prompts from YAML file
const promptsPath = join(process.cwd(), "src/app/api/chat/prompts.yaml");
const promptsFile = readFileSync(promptsPath, "utf-8");
const prompts = parse(promptsFile) as { traceAgent: { instructions: string } };

// In-memory conversation storage (in production, use a database or cache)
// Key: conversationId, Value: array of messages
const conversationStore = new Map<string, Array<{ role: "user" | "assistant"; content: string }>>();

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

    const { query, conversationId } = validationResponse.data;

    // Get or create conversation history
    let messages: Array<{ role: "user" | "assistant"; content: string }> = [];
    let currentConversationId = conversationId;

    if (currentConversationId) {
        // Load existing conversation history
        messages = conversationStore.get(currentConversationId) || [];
    } else {
        // Create new conversation ID
        currentConversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Add the new user message
    messages.push({ role: "user", content: query });

    // Initializing a new agent using Vercel's AI SDK, and then enabling logging via LangSmith.
    const textStream = streamText({
        model: openai("gpt-4o-mini"),
        system: prompts.traceAgent.instructions,
        messages: messages, // Use messages array for conversation context
        tools: {
            search_traces: searchTracesTool,
            get_trace_by_id: getTraceByIdTool,
        },
        stopWhen: stepCountIs(5), // Allow multiple steps so the agent can call tools and then continue with a response
    });

    // Get the full text after streaming completes to save to conversation history
    const fullTextPromise = textStream.text.then((text) => {
        // Save the assistant's response to conversation history
        messages.push({ role: "assistant", content: text });
        conversationStore.set(currentConversationId, messages);
        return text;
    }).catch((error) => {
        console.error("Error getting full text:", error);
        return "";
    });

    // Return the streamed response with conversationId in headers
    const response = textStream.toTextStreamResponse({
        headers: {
            "X-Conversation-Id": currentConversationId,
        },
    });

    // Don't await the promise - let it complete in the background
    fullTextPromise.catch(() => { }); // Suppress unhandled promise rejection

    return response;
}