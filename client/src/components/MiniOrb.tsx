"use client";

import { useMemo } from "react";
import { getColorForNode } from "~/lib/bubbles/colors";

interface MiniOrbProps {
    type: "l0Cluster" | "l1Cluster" | "l2Cluster";
    id: string;
    l2ClusterId?: number;
}

/**
 * Extract L2 cluster ID from cluster ID string
 * Handles formats like:
 * - "l2-3" -> 3
 * - "l1-3-5" -> 3
 * - "l0-3-5-2" -> 3
 * - "123" (numeric) -> try to extract from other formats
 */
function extractL2ClusterId(id: string, type: string): number | undefined {
    // For L2 clusters, extract the ID directly
    if (type === "l2Cluster") {
        const match = id.match(/l2[_-]?(\d+)/i);
        if (match) {
            return parseInt(match[1] ?? "", 10);
        }
        // Try pure numeric
        if (/^\d+$/.test(id)) {
            return parseInt(id, 10);
        }
        return undefined;
    }

    // For L1 and L0, extract L2 ID from the format
    // Formats: "l1-3-5", "l0-3-5-2", "l1_cluster_3_5", etc.
    const parts = id.split(/[_-]/);
    if (parts.length >= 2) {
        // Look for the number after "l1" or "l0"
        const l2Part = parts.find((part, idx) =>
            (part.toLowerCase() === "l1" || part.toLowerCase() === "l0") &&
            idx + 1 < parts.length
        );
        if (l2Part) {
            const l2Idx = parts.indexOf(l2Part);
            const l2Id = parseInt(parts[l2Idx + 1] ?? "", 10);
            if (!isNaN(l2Id)) {
                return l2Id;
            }
        }
        // Fallback: try second part if it's numeric
        if (parts.length >= 2 && /^\d+$/.test(parts[1] ?? "")) {
            return parseInt(parts[1] ?? "", 10);
        }
    }

    return undefined;
}

export default function MiniOrb({ type, id, l2ClusterId }: MiniOrbProps) {
    const clusterType = useMemo(() => {
        if (type === "l2Cluster") return "l2";
        if (type === "l1Cluster") return "l1";
        return "l0";
    }, [type]);

    const extractedL2Id = useMemo(() => {
        return l2ClusterId ?? extractL2ClusterId(id, type);
    }, [id, type, l2ClusterId]);

    const displayColor = useMemo(() => {
        // For L2 clusters, use the l2ClusterId directly to construct the proper ID
        const nodeId = type === "l2Cluster" && extractedL2Id !== undefined
            ? `l2-${extractedL2Id}`
            : id;

        const node: {
            type: "l2" | "l1" | "l0";
            id: string;
            l2_cluster_id?: number;
        } = {
            type: clusterType,
            id: nodeId,
            l2_cluster_id: extractedL2Id,
        };

        const color = getColorForNode(node);
        // Debug log to help troubleshoot
        if (color === "#D1D5DB") {
            console.log("MiniOrb: Using default gray color", { type, id, extractedL2Id, nodeId });
        }
        return color;
    }, [clusterType, id, type, extractedL2Id]);

    const baseColor = useMemo(() => {
        const node: {
            type: "l2" | "l1" | "l0";
            id: string;
            l2_cluster_id?: number;
        } = {
            type: clusterType,
            id: type === "l2Cluster" ? `l2-${extractedL2Id ?? 0}` : id,
            l2_cluster_id: extractedL2Id,
        };
        // Use a simpler approach - just use the display color with slight adjustment
        return displayColor;
    }, [clusterType, id, type, extractedL2Id, displayColor]);

    return (
        <div
            className="relative shrink-0"
            style={{ width: 10, height: 10 }}
        >
            {/* Mini orb with gradient */}
            <div
                className="rounded-full"
                style={{
                    width: 10,
                    height: 10,
                    background: `radial-gradient(circle at 30% 30%, ${displayColor}, ${baseColor})`,
                    boxShadow: `0 0 2px ${displayColor}80, inset 0 0 2px rgba(255, 255, 255, 0.3)`,
                }}
            />
        </div>
    );
}

