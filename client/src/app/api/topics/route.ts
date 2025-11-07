import { NextRequest, NextResponse } from 'next/server';
import { Pinecone } from "@pinecone-database/pinecone";

interface TopicVector {
  id: string;
  metadata: {
    type: "topic";
    description?: string;
    L0_cluster_id?: number;
    L1_cluster_id?: number;
    L2_cluster_id?: number;
  };
}

export async function GET(request: NextRequest) {
  console.log("🔵 GET /api/topics - Request received");
  try {
    const searchParams = request.nextUrl.searchParams;
    const l2Id = searchParams.get("l2");
    const l1Id = searchParams.get("l1");
    const l0Id = searchParams.get("l0");

    if (!l2Id || !l1Id) {
      return NextResponse.json(
        { error: "l2 and l1 parameters are required" },
        { status: 400 }
      );
    }

    if (!process.env.PINECONE_API_KEY) {
      throw new Error("PINECONE_API_KEY is not set");
    }

    const pc = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    // Build filter for Pinecone query
    const filter: Record<string, unknown> = {
      type: "topic",
      L2_cluster_id: Number(l2Id),
      L1_cluster_id: Number(l1Id),
    };

    // Add L0 filter if provided
    if (l0Id) {
      // l0Id could be:
      // 1. Numeric string like "46" (from l0_cluster_id property) ✅
      // 2. Format like "l0_cluster_46" (original vector ID) ✅
      // 3. Format like "l0-1-2-3" (generated node ID) ❌
      
      // Try parsing as number first (most common case - from l0_cluster_id property)
      const numericId = Number(l0Id);
      if (!isNaN(numericId) && numericId > 0) {
        filter.L0_cluster_id = numericId;
      } else if (l0Id.includes("_")) {
        // Handle formats like "l0_cluster_46" or "10_cluster_27"
        // Extract the last number (the actual L0_cluster_id)
        const numericMatch = l0Id.match(/(\d+)$/);
        if (numericMatch) {
          const extractedId = Number(numericMatch[1]);
          if (!isNaN(extractedId) && extractedId > 0) {
            filter.L0_cluster_id = extractedId;
            console.log(`Extracted L0_cluster_id ${extractedId} from ${l0Id}`);
          }
        }
      } else {
        // If not numeric, try to fetch the L0 cluster vector by its ID
        // L0 cluster vectors have numeric IDs that are the L0_cluster_id
        // But ClusterNode IDs might be like l0-{l2Id}-{l1Id}-{l0Index}
        try {
          const l0Vector = await pc.Index("openclio").fetch([l0Id]);
          if (l0Vector.records && l0Vector.records[l0Id]) {
            // The L0 cluster vector ID itself is the L0_cluster_id
            // But if we fetched by a generated ID, we need to check the actual vector ID
            const actualVectorId = l0Vector.records[l0Id]?.id;
            if (actualVectorId && /^\d+$/.test(actualVectorId)) {
              filter.L0_cluster_id = Number(actualVectorId);
            }
          }
        } catch (e) {
          // If fetch fails, try extracting numeric part from ID format like "l0-1-2-3"
          const numericMatch = l0Id.match(/(\d+)$/);
          if (numericMatch) {
            const extractedId = Number(numericMatch[1]);
            if (!isNaN(extractedId) && extractedId > 0) {
              // This is a fallback - might not be correct, but worth trying
              console.warn(`Using extracted L0 ID ${extractedId} from ${l0Id} - may be incorrect`);
              filter.L0_cluster_id = extractedId;
            }
          }
          if (!filter.L0_cluster_id) {
            console.warn(`Could not determine L0_cluster_id from ${l0Id}, will return all topics for L1`);
          }
        }
      }
    }

    console.log(`🔍 Querying Pinecone for topics with filter:`, filter);

    // Use a zero vector for querying (dimension for text-embedding-3-large is 3072)
    const dimension = 3072;
    const zeroVector = new Array(dimension).fill(0);

    const result = await pc.Index("openclio").query({
      vector: zeroVector,
      topK: 10000, // Max results per query
      includeMetadata: true,
      filter,
    });

    console.log(`✅ Query completed. Found ${result.matches.length} topic matches.`);

    // Process and merge chunks
    const baseId = (id: string): string => {
      // Extract base ID: topic_109_0 -> topic_109
      const match = id.match(/^(topic_\d+)/);
      return match && match[1] ? match[1] : id.replace(/_\d+$/, "");
    };

    const chunkIndex = (id: string): number => {
      // Extract chunk index: topic_109_1 -> 1
      const match = id.match(/_(\d+)$/);
      return match ? Number(match[1]) : 0;
    };

    const groups = new Map<string, { ids: string[]; texts: string[] }>();

    for (const match of result.matches) {
      const metadata = match.metadata;
      if (!metadata || metadata.type !== "topic") {
        continue;
      }

      const base = baseId(match.id);
      const idx = chunkIndex(match.id);
      const text = typeof metadata.description === 'string' ? metadata.description : "";

      const group = groups.get(base) ?? { ids: [], texts: [] };
      
      // Store chunks in order (may have gaps, but we'll filter them out)
      // Ensure arrays are large enough
      while (group.ids.length <= idx) {
        group.ids.push("");
        group.texts.push("");
      }
      
      group.ids[idx] = match.id;
      group.texts[idx] = text;
      groups.set(base, group);
    }

    // Convert groups to TopicSummary format
    const topics = Array.from(groups.entries()).map(([baseId, group]) => {
      // Filter out empty slots and join texts in order
      const validIds = group.ids.filter(Boolean);
      const validTexts = group.texts.filter(Boolean);
      
      return {
        id: baseId,
        chunkIds: validIds,
        text: validTexts.join(" "),
      };
    });

    console.log(`📊 Processed ${topics.length} merged topics from ${result.matches.length} chunks`);

    return NextResponse.json({ success: true, topics });
  } catch (error) {
    console.error('Pinecone query error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

