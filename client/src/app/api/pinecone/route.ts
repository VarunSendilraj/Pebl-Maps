import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from "@pinecone-database/pinecone";
import { OpenAI } from "openai";
import { z } from 'zod';
import type { QueryResponse } from "@pinecone-database/pinecone/dist/data/vectors/query.d.ts";

const querySchema = z.object({
  query: z.string().min(1, "Query is required"),
});

// The only information that's useful for us to extract is the trace's ID (used to control the trace viewer on the frontend) and the description (shown in the chat window).
interface Trace {
  id: string,
  description: string,
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validationResult = querySchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({
        error: 'Invalid input',
        details: validationResult.error.errors
      }, { status: 400 });
    }

    const { query } = validationResult.data;

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

    const response = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: query,
    });

    const embedding = response?.data[0]?.embedding as number[];
    if (embedding === undefined) {
      throw new Error("OpenAI embedding is undefined.");
    }

    const result = await pc.Index("openclio").query({
      vector: embedding,
      topK: 10,
      includeMetadata: true,
      filter: {
        type: "topic",
      },
    });

    // Maps matches into Trace objects, containing exactly the information that's relevant to us.
    const matches: Trace[] = result.matches.map((match) => {
      if (match.metadata?.description === undefined || typeof match.metadata.description !== 'string') {
        throw new Error("Metadata description is undefined.");
      }
      return {
        id: match.id,
        description: match.metadata.description,
      };
    });

    return NextResponse.json({ success: true, result: matches });
  } catch (error) {
    console.error('Pinecone query error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}