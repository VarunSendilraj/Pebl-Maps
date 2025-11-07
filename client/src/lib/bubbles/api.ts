import type { ClusterNode, TopicSummary } from "./types";
import { buildClusterTree, type ClusterVector } from "./transform";

/**
 * Fetches all clusters from Pinecone and transforms them into ClusterNode tree structure
 */
export async function fetchClusters(): Promise<ClusterNode[]> {
  try {
    const response = await fetch("/api/clusters");
    
    if (!response.ok) {
      throw new Error(`Failed to fetch clusters: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !Array.isArray(data.clusters)) {
      throw new Error("Invalid response format from clusters API");
    }

    const clusters: ClusterVector[] = data.clusters;
    return buildClusterTree(clusters);
  } catch (error) {
    console.error("Error fetching clusters:", error);
    throw error;
  }
}

/**
 * Extracts cluster IDs from a cluster node ID
 * L2: l2-{l2Id} -> { l2Id }
 * L1: l1-{l2Id}-{l1Id} -> { l2Id, l1Id }
 * L0: l0-{l2Id}-{l1Id}-{l0Index} -> { l2Id, l1Id, l0Index }
 */
function extractClusterIds(nodeId: string, nodeType: "l2" | "l1" | "l0"): {
  l2Id: number | null;
  l1Id: number | null;
  l0Index: number | null;
} {
  const parts = nodeId.split("-");
  
  if (nodeType === "l2") {
    // l2-{l2Id}
    const l2Id = parts.length >= 2 ? parseInt(parts[1] ?? "", 10) : null;
    return { l2Id: isNaN(l2Id ?? 0) ? null : l2Id, l1Id: null, l0Index: null };
  } else if (nodeType === "l1") {
    // l1-{l2Id}-{l1Id}
    const l2Id = parts.length >= 2 ? parseInt(parts[1] ?? "", 10) : null;
    const l1Id = parts.length >= 3 ? parseInt(parts[2] ?? "", 10) : null;
    return {
      l2Id: isNaN(l2Id ?? 0) ? null : l2Id,
      l1Id: isNaN(l1Id ?? 0) ? null : l1Id,
      l0Index: null,
    };
  } else {
    // l0-{l2Id}-{l1Id}-{l0Index}
    const l2Id = parts.length >= 2 ? parseInt(parts[1] ?? "", 10) : null;
    const l1Id = parts.length >= 3 ? parseInt(parts[2] ?? "", 10) : null;
    const l0Index = parts.length >= 4 ? parseInt(parts[3] ?? "", 10) : null;
    return {
      l2Id: isNaN(l2Id ?? 0) ? null : l2Id,
      l1Id: isNaN(l1Id ?? 0) ? null : l1Id,
      l0Index: isNaN(l0Index ?? 0) ? null : l0Index,
    };
  }
}

/**
 * Fetches topics for an L0 cluster node
 */
export async function fetchTopicsForL0(l0Node: ClusterNode): Promise<TopicSummary[]> {
  try {
    // Use stored cluster IDs if available, otherwise extract from ID
    let l2Id = l0Node.l2_cluster_id ?? extractClusterIds(l0Node.id, "l0").l2Id;
    let l1Id = l0Node.l1_cluster_id ?? extractClusterIds(l0Node.id, "l0").l1Id;
    const l0ClusterId = l0Node.l0_cluster_id;
    
    // If we still don't have the IDs, try to extract from formats like "10_cluster_27"
    // This format might contain the cluster IDs in a different structure
    if ((l2Id == null || l1Id == null) && l0Node.id.includes("_")) {
      // Try parsing formats like "10_cluster_27" where numbers might represent IDs
      const parts = l0Node.id.split("_");
      // This is a fallback - we'll try to use the first number as L2 and last as L0
      // But ideally we should fetch from Pinecone to get the actual metadata
      console.warn(`Attempting to parse cluster IDs from non-standard format: ${l0Node.id}`);
    }
    
    if (l2Id == null || l1Id == null) {
      // Last resort: try to fetch the L0 cluster vector from Pinecone to get the metadata
      console.warn(`Missing cluster IDs for node ${l0Node.id}, attempting to fetch from Pinecone...`);
      try {
        const response = await fetch(`/api/clusters`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.clusters)) {
            const l0Vector = data.clusters.find((c: { id: string }) => c.id === l0Node.id);
            if (l0Vector?.metadata) {
              l2Id = l2Id ?? l0Vector.metadata.L2_cluster_id;
              l1Id = l1Id ?? l0Vector.metadata.L1_cluster_id;
            }
          }
        }
      } catch (e) {
        console.error("Failed to fetch cluster metadata:", e);
      }
    }
    
    if (l2Id == null || l1Id == null) {
      throw new Error(`Invalid L0 node: missing cluster IDs. Node ID: ${l0Node.id}. Please ensure L0 cluster vectors have L1_cluster_id and L2_cluster_id in their metadata.`);
    }

    const params = new URLSearchParams({
      l2: l2Id.toString(),
      l1: l1Id.toString(),
    });

    // Add L0 cluster ID if available
    if (l0ClusterId !== undefined) {
      params.set("l0", l0ClusterId.toString());
    } else {
      // Fallback: pass the node ID in case API can extract it
      params.set("l0", l0Node.id);
    }

    const response = await fetch(`/api/topics?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch topics: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !Array.isArray(data.topics)) {
      throw new Error("Invalid response format from topics API");
    }

    return data.topics as TopicSummary[];
  } catch (error) {
    console.error("Error fetching topics:", error);
    throw error;
  }
}

