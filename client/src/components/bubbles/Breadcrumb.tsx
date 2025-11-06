"use client";

import type { ClusterNode } from "~/lib/bubbles/types";

interface BreadcrumbProps {
  path: ClusterNode[];
  currentRoot: ClusterNode;
  onNavigate: (index: number) => void;
  onRoot: () => void;
}

export default function Breadcrumb({ path, currentRoot, onNavigate, onRoot }: BreadcrumbProps) {
  // Don't show breadcrumb if we're at the synthetic root
  const isAtRoot = currentRoot.id === "__root__";
  if (isAtRoot && path.length === 0) return null;

  return (
    <div className="mb-4 flex items-center gap-2 text-sm">
      <button
        onClick={onRoot}
        className="text-blue-500 hover:text-blue-700 underline transition-colors"
      >
        Root
      </button>
      {path.map((crumb, index) => (
        <div key={`${crumb.id}-${index}`} className="flex items-center gap-2">
          <span className="text-slate-400">/</span>
          <button
            onClick={() => onNavigate(index)}
            className="text-blue-500 hover:text-blue-700 underline transition-colors"
          >
            {crumb.name}
          </button>
        </div>
      ))}
      {/* Show current root if it's not the synthetic root and not already in path */}
      {!isAtRoot && (path.length === 0 || path[path.length - 1]?.id !== currentRoot.id) && (
        <div className="flex items-center gap-2">
          <span className="text-slate-400">/</span>
          <span className="text-slate-600 font-medium">{currentRoot.name}</span>
        </div>
      )}
    </div>
  );
}

