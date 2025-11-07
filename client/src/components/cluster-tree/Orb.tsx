"use client";

import { useMemo } from "react";
import type { ClusterType } from "~/lib/bubbles/types";
import { getColorForNode, getBaseColorForNode } from "~/lib/bubbles/colors";

interface OrbProps {
  node: {
    type: ClusterType;
    l2_cluster_id?: number;
    id: string;
    trace_count?: number;
  };
  isExpanded?: boolean;
  isSelected?: boolean;
  isHovered?: boolean;
  className?: string;
}

/**
 * Calculate orb size based on trace_count and depth
 * L2: 12-16px, L1: 10-14px, L0: 8-12px
 * Smooth scale = 8px + 4px * clamp01(log10(1 + trace_count)/2)
 */
function calculateOrbSize(
  traceCount: number | undefined,
  type: ClusterType
): number {
  const baseSize = type === "l2" ? 12 : type === "l1" ? 10 : 8;
  const maxSize = type === "l2" ? 16 : type === "l1" ? 14 : 12;
  const range = maxSize - baseSize;

  if (!traceCount || traceCount === 0) {
    return baseSize;
  }

  // Normalize: clamp01(log10(1 + trace_count) / 2)
  const normalized = Math.min(1, Math.max(0, Math.log10(1 + traceCount) / 2));
  return baseSize + range * normalized;
}

export default function Orb({
  node,
  isExpanded = false,
  isSelected = false,
  isHovered = false,
  className = "",
}: OrbProps) {
  const baseColor = useMemo(() => getBaseColorForNode(node), [node]);
  const displayColor = useMemo(() => getColorForNode(node), [node]);
  const size = useMemo(
    () => calculateOrbSize(node.trace_count, node.type),
    [node.trace_count, node.type]
  );

  // Glow intensity based on state
  const glowIntensity = isHovered ? 1.3 : isExpanded ? 1.2 : 1.0;
  const glowSize = size * 0.8 * glowIntensity;
  const glowOpacity = isHovered ? 0.6 : isExpanded ? 0.5 : 0.4;

  // Border ring for selected/expanded state
  const borderWidth = isExpanded || isSelected ? 2 : 0;
  const borderColor = getBaseColorForNode(node);

  // Convert hex color to rgba for boxShadow
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-200"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${displayColor}88, ${displayColor}44, transparent)`,
          filter: `blur(${glowSize}px)`,
          opacity: glowOpacity,
          transform: "scale(1.2)",
        }}
      />
      
      {/* Main orb */}
      <div
        className="relative rounded-full transition-all duration-200"
        style={{
          width: size,
          height: size,
          background: `radial-gradient(circle at 30% 30%, ${displayColor}, ${baseColor})`,
          boxShadow: `
            0 0 ${glowSize}px ${hexToRgba(displayColor, glowOpacity)},
            inset 0 0 ${size * 0.3}px rgba(255, 255, 255, 0.2)
          `,
          border: borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : "none",
        }}
      />
    </div>
  );
}

