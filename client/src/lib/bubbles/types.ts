export type ClusterType = "l2" | "l1" | "l0";

export interface ClusterNode {
  id: string;
  name: string;
  type: ClusterType;
  trace_count?: number;
  children?: ClusterNode[];
  // Store original cluster IDs for API queries
  l0_cluster_id?: number; // For L0 nodes: the numeric L0_cluster_id from Pinecone
  l1_cluster_id?: number; // For L1 nodes: the numeric L1_cluster_id
  l2_cluster_id?: number; // For L2 nodes: the numeric L2_cluster_id
}

export interface PackedNode extends ClusterNode {
  x: number;
  y: number;
  r: number;
  depth: number;
  value?: number;
  parent?: PackedNode;
  children?: PackedNode[];
}

export interface TopicSummary {
  id: string;
  text: string;
  chunkIds: string[];
}

