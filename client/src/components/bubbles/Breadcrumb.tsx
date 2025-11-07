"use client";

import type { ClusterNode } from "~/lib/bubbles/types";

interface BreadcrumbProps {
  path: ClusterNode[];
  currentRoot: ClusterNode;
  onNavigate: (index: number) => void;
  onRoot: () => void;
}

export default function Breadcrumb({ path, currentRoot, onNavigate, onRoot }: BreadcrumbProps) {
  const isAtRoot = currentRoot.id === "__root__";

  return (
    <div className="flex items-center justify-center gap-2 pb-4 text-sm">
      {/* Always show Root */}
      <button
        onClick={onRoot}
        className="rounded-lg border border-[#d5d5d5] px-3 py-1 font-sans font-bold text-[#8a817c] underline transition-all hover:bg-[#8a817c]/10"
      >
        Root
      </button>
      {path.map((crumb, index) => (
        <div key={`${crumb.id}-${index}`} className="flex items-center gap-2">
          <span className="font-sans font-bold text-[#8a817c]">/</span>
          <button
            onClick={() => onNavigate(index)}
            className="rounded-lg border border-[#d5d5d5] px-3 py-1 font-sans font-bold text-[#8a817c] underline transition-all hover:bg-[#8a817c]/10"
          >
            {crumb.name}
          </button>
        </div>
      ))}
      {/* Show current root if it's not the synthetic root and not already in path */}
      {!isAtRoot && (path.length === 0 || path[path.length - 1]?.id !== currentRoot.id) && (
        <div className="flex items-center gap-2">
          <span className="font-sans font-bold text-[#8a817c]">/</span>
          <span className="rounded-lg border border-[#d5d5d5] px-3 py-1 font-sans font-bold text-[#8a817c] underline">
            {currentRoot.name}
          </span>
        </div>
      )}
    </div>
  );
}

