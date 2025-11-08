import { z } from "zod";
import { tool } from "@openai/agents";
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAI } from "openai";
import { trace } from "node:console";

interface Trace {
    id: string,
    description: string,
}

export const getTraceByIdTool = tool({
    name: "get_trace_by_id",
    description: "Retrieves the full details of a trace from Pinecone by its id, performing an exact id match. Only use this tool if the user explicitly references a trace id using the format <tid={id}>. Do not use for partial matches, descriptions, or general queries. Return the complete trace details if found; otherwise, indicate no match.",
    parameters: z.object({
        id: z.string().describe("The id of the trace to get. Should be the id part of the <tid={id}> format."),
    }),
    execute: async (input: { id: string }) => {
        if (!process.env.PINECONE_API_KEY) {
            throw new Error("PINECONE_API_KEY is not set");
        }
        const pc = new Pinecone({
            apiKey: process.env.PINECONE_API_KEY,
        });

        const result = await pc.Index("openclio").fetch([input.id]);
        if (result.records && result.records[input.id]) {
            const metadata = result?.records?.[input.id]?.metadata;
            if (metadata?.description === undefined || typeof metadata.description !== 'string') {
                throw new Error("Metadata description is undefined.");
            }
            const trace: Trace = {
                id: input.id,
                description: metadata?.description,
            }
            console.log("getTraceById tool executed successfully.");
            console.log("Trace:", trace);
            return {
                success: true, trace: trace
            };

        } else {
            return { success: false, error: "Trace not found" };
        }
    },
});

const searchTracesParameters = z.object({
    query: z.string().describe("The search query to find relevant traces"),
    l0_cluster_id: z.number()
        .nullable()
        .default(null)
        .describe("Optional L0 cluster ID to filter traces. Only use when explicitly mentioned or tagged (e.g., <tid=l0_cluster_22>) in the user's query. Extract the numeric ID from the tag (e.g., from <tid=l0_cluster_22> extract 22). Pass null when not filtering by L0."),
    l1_cluster_id: z.number()
        .nullable()
        .default(null)
        .describe("Optional L1 cluster ID to filter traces. Only use when explicitly mentioned or tagged (e.g., <tid=l1_cluster_22>) in the user's query. Extract the numeric ID from the tag (e.g., from <tid=l1_cluster_22> extract 22). Pass null when not filtering by L1."),
    l2_cluster_id: z.number()
        .nullable()
        .default(null)
        .describe("Optional L2 cluster ID to filter traces. Only use when explicitly mentioned or tagged (e.g., <tid=l2_cluster_22>) in the user's query. Extract the numeric ID from the tag (e.g., from <tid=l2_cluster_22> extract 22). Pass null when not filtering by L2."),
});

type SearchTracesInput = z.infer<typeof searchTracesParameters>;

export const searchTracesTool = tool({
    name: "search_traces",
    description: "Search for traces in Pinecone using semantic similarity. Returns relevant traces based on the query. Optionally filter by cluster level (L0, L1, or L2) when a cluster ID is explicitly mentioned or tagged in the conversation.",
    parameters: searchTracesParameters,
    execute: async (input: SearchTracesInput) => {
        try {
            if (!process.env.PINECONE_API_KEY) {
                throw new Error("PINECONE_API_KEY is not set");
            }

            if (!process.env.OPENAI_API_KEY) {
                throw new Error("OPENAI_API_KEY is not set");
            }

            const pc = new Pinecone({
                apiKey: process.env.PINECONE_API_KEY,
            });

            const openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });

            const { query, l0_cluster_id, l1_cluster_id, l2_cluster_id } = input;

            const response = await openai.embeddings.create({
                model: "text-embedding-3-large",
                input: query,
            });

            const embedding = response?.data[0]?.embedding as number[];
            if (embedding === undefined) {
                throw new Error("OpenAI embedding is undefined.");
            }

            // Build filter dynamically based on provided cluster IDs
            const filter: Record<string, unknown> = {
                type: "topic",
            };

            // Add cluster filters if provided (only one level at a time)
            if (l0_cluster_id !== null) {
                filter.L0_cluster_id = l0_cluster_id;
            } else if (l1_cluster_id !== null) {
                filter.L1_cluster_id = l1_cluster_id;
            } else if (l2_cluster_id !== null) {
                filter.L2_cluster_id = l2_cluster_id;
            }

            const result = await pc.Index("openclio").query({
                vector: embedding,
                topK: 10,
                includeMetadata: true,
                filter,
            });

            const matches: Trace[] = result.matches.map((match) => {
                if (match.metadata?.description === undefined || typeof match.metadata.description !== 'string') {
                    throw new Error("Metadata description is undefined.");
                }
                return {
                    id: match.id,
                    description: match.metadata.description,
                };
            });
            console.log("searchTraces tool executed successfully.");
            console.log("Matches:", matches);

            return { success: true, traces: matches };
        } catch (error) {
            console.error('Pinecone query error:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return { success: false, error: errorMessage };
        }
    },
});
