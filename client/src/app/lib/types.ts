export type ClusterType = "l2" | "l1" | "l0";

export interface ClusterNode {
    id: string;
    name: string;
    type: ClusterType;
    trace_count?: number;
    children?: ClusterNode[];
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


