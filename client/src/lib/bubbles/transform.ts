import type { ClusterNode } from "./types";

// Input: Cluster vector from Pinecone API
export interface ClusterVector {
  id: string;
  metadata: {
    type: "l0_cluster" | "l1_cluster" | "l2_cluster";
    name: string;
    trace_count?: number;
    L1_cluster_id?: number;
    L2_cluster_id?: number;
    description?: string;
  };
}

/**
 * Builds a hierarchical ClusterNode tree from flat Pinecone cluster vectors
 */
export function buildClusterTree(vectors: ClusterVector[]): ClusterNode[] {
  // Separate vectors by type
  const l2Vectors = vectors.filter(v => v.metadata.type === "l2_cluster");
  const l1Vectors = vectors.filter(v => v.metadata.type === "l1_cluster");
  const l0Vectors = vectors.filter(v => v.metadata.type === "l0_cluster");

  // Build L2 nodes
  // For L2 clusters, we need to extract their ID from the vector id or metadata
  // L2 clusters might have L2_cluster_id in metadata, or we extract it from the id
  const l2Nodes: ClusterNode[] = l2Vectors.map(l2 => {
    // Extract L2 cluster ID - try metadata first, then parse from id (e.g., "l2_cluster_3" -> 3)
    let l2ClusterId: number | undefined = l2.metadata.L2_cluster_id;
    if (l2ClusterId === undefined) {
      // Try to extract from id like "l2_cluster_3" or "l2-3"
      const idMatch = l2.id.match(/(?:l2[_-]?cluster[_-]?|l2[_-])(\d+)/i);
      l2ClusterId = idMatch ? parseInt(idMatch[1] ?? "", 10) : undefined;
      if (isNaN(l2ClusterId ?? 0)) {
        l2ClusterId = undefined;
      }
    }
    if (l2ClusterId === undefined) {
      throw new Error(`Could not extract L2 cluster ID from vector ${l2.id}`);
    }
    const l2Id = `l2-${l2ClusterId}`;
    
    // Find all L1 clusters that belong to this L2
    const l1Children = l1Vectors
      .filter(l1 => l1.metadata.L2_cluster_id === l2ClusterId)
      .map((l1, l1Index) => {
        // Extract L1 cluster ID from metadata or ID
        let l1ClusterId: number | undefined = l1.metadata.L1_cluster_id;
        if (l1ClusterId === undefined) {
          // Try to extract from id like "l1_cluster_3" -> 3
          const idMatch = l1.id.match(/(?:l1[_-]?cluster[_-]?|l1[_-])(\d+)/i);
          l1ClusterId = idMatch ? parseInt(idMatch[1] ?? "", 10) : l1Index;
          if (isNaN(l1ClusterId ?? 0)) {
            l1ClusterId = l1Index;
          }
        }
        const l1Id = `l1-${l2ClusterId}-${l1ClusterId}`;
        
        // Find all L0 clusters that belong to this L1
        const l0Children = l0Vectors
          .filter(l0 => 
            l0.metadata.L2_cluster_id === l2ClusterId &&
            l0.metadata.L1_cluster_id === l1ClusterId
          )
          .map((l0, l0Index) => {
            // Extract L0_cluster_id from vector ID
            // L0 cluster vectors have IDs that are the numeric L0_cluster_id (e.g., "123")
            // But they might also be in formats like "10_cluster_27" or "l0_123"
            let l0ClusterId: number | undefined;
            if (/^\d+$/.test(l0.id)) {
              // ID is purely numeric - this is the L0_cluster_id
              l0ClusterId = Number(l0.id);
            } else {
              // Try to extract numeric part from ID formats like "l0_123", "l0-123", or "10_cluster_27"
              // For "10_cluster_27", we want to extract "27" (the last number)
              const numericMatch = l0.id.match(/(\d+)$/);
              if (numericMatch) {
                l0ClusterId = Number(numericMatch[1]);
              }
            }
            
            // CRITICAL: Always use metadata for L1 and L2 cluster IDs as they're guaranteed to be correct
            // The metadata comes directly from Pinecone and is the source of truth
            const l1IdFromMetadata = l0.metadata.L1_cluster_id ?? l1ClusterId;
            const l2IdFromMetadata = l0.metadata.L2_cluster_id ?? l2ClusterId;
            
            // Use vector id if it's numeric or starts with l0_/l0_cluster_/l0-, otherwise generate one
            // But prefer numeric IDs since they are the actual L0_cluster_id
            // Handle formats: "123", "l0_123", "l0_cluster_46", "l0-1-2-3"
            const l0Id = /^\d+$/.test(l0.id) || 
                         l0.id.startsWith("l0_") || 
                         l0.id.startsWith("l0_cluster_") ||
                         l0.id.startsWith("l0-")
              ? l0.id 
              : `l0-${l2IdFromMetadata}-${l1IdFromMetadata}-${l0Index}`;
            
            return {
              id: l0Id,
              name: l0.metadata.name,
              type: "l0" as const,
              trace_count: l0.metadata.trace_count,
              l0_cluster_id: l0ClusterId,
              // Always use metadata values - they're the source of truth
              l1_cluster_id: l1IdFromMetadata,
              l2_cluster_id: l2IdFromMetadata,
            };
          });

        // Calculate L1 trace_count if not provided (sum of children)
        const l1TraceCount = l1.metadata.trace_count ?? 
          l0Children.reduce((sum, l0) => sum + (l0.trace_count ?? 0), 0);

        return {
          id: l1Id,
          name: l1.metadata.name,
          type: "l1" as const,
          trace_count: l1TraceCount,
          children: l0Children.length > 0 ? l0Children : undefined,
          l1_cluster_id: l1ClusterId,
          l2_cluster_id: l2ClusterId,
        };
      });

    // Calculate L2 trace_count if not provided (sum of children)
    const l2TraceCount = l2.metadata.trace_count ?? 
      l1Children.reduce((sum, l1) => sum + (l1.trace_count ?? 0), 0);

    return {
      id: l2Id,
      name: l2.metadata.name,
      type: "l2" as const,
      trace_count: l2TraceCount,
      children: l1Children.length > 0 ? l1Children : undefined,
      l2_cluster_id: l2ClusterId as number,
    };
  });

  return l2Nodes;
}

