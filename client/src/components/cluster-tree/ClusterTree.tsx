"use client";

import { useState, useCallback, useRef, useEffect, useImperativeHandle, forwardRef, useMemo } from "react";
import type { ClusterNode, TopicSummary } from "~/lib/bubbles/types";
import { fetchTopicsForL0 } from "~/lib/bubbles/api";
import Orb from "./Orb";
import LoadingOrbs from "./LoadingOrbs";
import SyncToggle from "./SyncToggle";
import { getColorForNode } from "~/lib/bubbles/colors";
import { useNavigationState, useNavigationActions } from "~/contexts/NavigationContext";

interface ClusterTreeProps {
  data: ClusterNode[];
  onSelectTopic?: (topic: TopicSummary) => void;
  onSelectNode?: (node: ClusterNode) => void;
  onResetRequest?: () => void;
}

interface TopicCache {
  topics: TopicSummary[];
  loading: boolean;
  error: string | null;
}

export interface ClusterTreeRef {
  reset: () => void;
}

const ClusterTree = forwardRef<ClusterTreeRef, ClusterTreeProps>(function ClusterTree({
  data,
  onSelectTopic,
  onSelectNode,
  onResetRequest,
}, ref) {
  const navigationState = useNavigationState();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [topicCache, setTopicCache] = useState<Map<string, TopicCache>>(
    new Map()
  );
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const fetchingRef = useRef<Set<string>>(new Set()); // Track nodes currently being fetched

  // Flatten nodes for keyboard navigation
  const flattenNodes = useCallback((nodes: ClusterNode[], depth = 0): ClusterNode[] => {
    const result: ClusterNode[] = [];
    for (const node of nodes) {
      result.push(node);
      if (expandedIds.has(node.id) && node.children) {
        result.push(...flattenNodes(node.children, depth + 1));
      }
    }
    return result;
  }, [expandedIds]);

  const allNodes = flattenNodes(data);

  // Expose reset function via ref
  useImperativeHandle(ref, () => ({
    reset: () => {
      setExpandedIds(new Set());
      setFocusedId(null);
    },
  }));

  // Create synthetic root data for home button
  const rootData: ClusterNode = useMemo(() => {
    return { id: "__root__", name: "Root", type: "l2", children: data };
  }, [data]);

  // Handle reset request from home button
  const handleResetRequest = useCallback(() => {
    setExpandedIds(new Set());
    setFocusedId(null);
    onResetRequest?.();
  }, [onResetRequest]);

  // Helper function to find an L0 node by ID in the data tree
  const findL0Node = useCallback((nodeId: string, nodes: ClusterNode[]): ClusterNode | null => {
    for (const node of nodes) {
      if (node.id === nodeId && node.type === "l0") {
        return node;
      }
      if (node.children) {
        const found = findL0Node(nodeId, node.children);
        if (found) return found;
      }
    }
    return null;
  }, []);

  // Auto-expand and scroll to follow navigation from BubbleCanvas (only if sync mode is enabled)
  useEffect(() => {
    // Only auto-expand/scroll if sync mode is enabled
    if (!navigationState.isSyncModeEnabled) {
      return;
    }

    // Expand all nodes in the breadcrumb path + current root + expanded L0 nodes
    const nodesToExpand = new Set<string>();
    
    // Add all breadcrumb nodes
    navigationState.breadcrumbPath.forEach(node => {
      nodesToExpand.add(node.id);
    });
    
    // Add current root if it's not the synthetic root
    if (navigationState.currentRootNode && navigationState.currentRootNode.id !== "__root__") {
      nodesToExpand.add(navigationState.currentRootNode.id);
    }
    
    // Add all expanded L0 nodes (these are expanded when clicking L0 clusters in BubbleCanvas)
    navigationState.expandedL0NodeIds.forEach(l0NodeId => {
      nodesToExpand.add(l0NodeId);
    });
    
    // Merge with existing expanded nodes (don't collapse what user manually expanded)
    setExpandedIds(prev => {
      const next = new Set(prev);
      nodesToExpand.forEach(id => next.add(id));
      return next;
    });
    
    // Scroll to selected node if it exists
    if (navigationState.selectedNodeId) {
      const nodeElement = nodeRefs.current.get(navigationState.selectedNodeId);
      if (nodeElement) {
        nodeElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
          inline: 'nearest'
        });
      }
    }
  }, [navigationState.breadcrumbPath, navigationState.currentRootNode, navigationState.selectedNodeId, navigationState.expandedL0NodeIds, navigationState.isSyncModeEnabled]);

  // Auto-fetch topics for L0 nodes that are expanded via sync
  useEffect(() => {
    // Only auto-fetch if sync mode is enabled
    if (!navigationState.isSyncModeEnabled) {
      return;
    }

    // For each expanded L0 node, check if we need to fetch topics
    navigationState.expandedL0NodeIds.forEach((l0NodeId) => {
      // Skip if topics are already loaded or currently being fetched
      if (topicCache.has(l0NodeId) || fetchingRef.current.has(l0NodeId)) {
        return;
      }

      // Find the L0 node in the data tree
      const l0Node = findL0Node(l0NodeId, data);
      if (!l0Node || l0Node.type !== "l0") {
        return;
      }

      // Mark as fetching
      fetchingRef.current.add(l0NodeId);

      // Mark as loading in cache
      setTopicCache((prev) => {
        const next = new Map(prev);
        next.set(l0NodeId, { topics: [], loading: true, error: null });
        return next;
      });

      // Fetch topics
      fetchTopicsForL0(l0Node)
        .then((topics) => {
          fetchingRef.current.delete(l0NodeId);
          setTopicCache((prev) => {
            const next = new Map(prev);
            next.set(l0NodeId, { topics, loading: false, error: null });
            return next;
          });
        })
        .catch((error) => {
          fetchingRef.current.delete(l0NodeId);
          setTopicCache((prev) => {
            const next = new Map(prev);
            next.set(l0NodeId, {
              topics: [],
              loading: false,
              error: error instanceof Error ? error.message : "Failed to load topics",
            });
            return next;
          });
        });
    });
  }, [navigationState.expandedL0NodeIds, navigationState.isSyncModeEnabled, findL0Node, data]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!focusedId || !treeRef.current) return;

      const currentIndex = allNodes.findIndex((n) => n.id === focusedId);
      if (currentIndex === -1) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (currentIndex < allNodes.length - 1) {
            setFocusedId(allNodes[currentIndex + 1]?.id ?? null);
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (currentIndex > 0) {
            setFocusedId(allNodes[currentIndex - 1]?.id ?? null);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          if (!expandedIds.has(focusedId)) {
            void handleNodeClick(allNodes[currentIndex]!);
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (expandedIds.has(focusedId)) {
            toggleExpanded(focusedId);
          }
          break;
        case "Enter":
          e.preventDefault();
          void handleNodeClick(allNodes[currentIndex]!);
          break;
      }
    };

    if (focusedId) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [focusedId, allNodes, expandedIds]);

  const toggleExpanded = useCallback((nodeId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  const handleNodeClick = useCallback(
    async (node: ClusterNode) => {
      onSelectNode?.(node);

      // If it's an L0 node and not already loaded, fetch topics
      if (node.type === "l0" && !topicCache.has(node.id)) {
        setTopicCache((prev) => {
          const next = new Map(prev);
          next.set(node.id, { topics: [], loading: true, error: null });
          return next;
        });

        try {
          const topics = await fetchTopicsForL0(node);
          setTopicCache((prev) => {
            const next = new Map(prev);
            next.set(node.id, { topics, loading: false, error: null });
            return next;
          });
        } catch (error) {
          setTopicCache((prev) => {
            const next = new Map(prev);
            next.set(node.id, {
              topics: [],
              loading: false,
              error:
                error instanceof Error ? error.message : "Failed to load topics",
            });
          return next;
          });
        }
      }

      toggleExpanded(node.id);
    },
    [onSelectNode, topicCache, toggleExpanded]
  );

  const renderNode = (node: ClusterNode, depth: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isL0 = node.type === "l0";
    const topicData = isL0 ? topicCache.get(node.id) : null;
    const isHovered = hoveredId === node.id;
    // Check if this node is focused locally OR selected via navigation
    const isFocused = focusedId === node.id || navigationState.selectedNodeId === node.id;
    const nodeColor = getColorForNode(node);

    // Calculate indentation with vertical guide
    const indentPx = depth * 16 + 8; // 16px per level + 8px base

    return (
      <div key={node.id} className="select-none relative">
        <div
          ref={(el) => {
            if (el) {
              nodeRefs.current.set(node.id, el);
            } else {
              nodeRefs.current.delete(node.id);
            }
          }}
          role="treeitem"
          tabIndex={isFocused ? 0 : -1}
          aria-expanded={hasChildren || isL0 ? isExpanded : undefined}
          className={`flex items-center gap-2 px-1.5 py-1.5 cursor-pointer rounded text-sm transition-colors relative ${
            isHovered ? "" : ""
          } ${isFocused ? "ring-1 ring-[#8b4a3a] ring-inset ring-opacity-30" : ""}`}
          style={{
            paddingLeft: `${indentPx}px`,
            backgroundColor: isHovered ? 'rgba(201, 196, 188, 0.4)' : 'transparent',
          }}
          onClick={() => {
            setFocusedId(node.id);
            handleNodeClick(node);
          }}
          onMouseEnter={() => setHoveredId(node.id)}
          onMouseLeave={() => setHoveredId(null)}
          onFocus={() => setFocusedId(node.id)}
          onBlur={() => {
            // Don't blur immediately to allow keyboard navigation
            setTimeout(() => {
              if (document.activeElement !== treeRef.current) {
                setFocusedId(null);
              }
            }, 100);
          }}
        >

          {/* Orb */}
          <div className="shrink-0">
            <Orb
              node={node}
              isExpanded={isExpanded}
              isSelected={isFocused}
              isHovered={isHovered}
            />
          </div>

          {/* Optional subtle chevron */}
          {(hasChildren || isL0) && (
            <svg
              className={`w-2.5 h-2.5 transition-transform shrink-0 ${
                isExpanded ? "rotate-90" : ""
              }`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              style={{ color: nodeColor }}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}

          {/* Node name */}
          <span
            className={`flex-1 truncate font-medium transition-colors ${
              isHovered ? "underline" : ""
            }`}
            style={{ color: "#8a817c" }}
          >
            {node.name}
          </span>

          {/* Trace count */}
          {node.trace_count !== undefined && !isL0 && (
            <span className="text-xs shrink-0" style={{ color: "#8a817c" }}>
              ({node.trace_count})
            </span>
          )}
        </div>

        {/* Children or topics */}
        {isExpanded && (
          <div className="relative">
            {/* Vertical guide line for children */}
            {hasChildren && !isL0 && depth >= 0 && (
              <div
                className="absolute w-px bg-gray-200"
                style={{
                  left: `${indentPx + 8}px`,
                  top: 0,
                  bottom: 0,
                }}
              />
            )}
            {hasChildren && !isL0 && (
              <div>
                {node.children?.map((child) => renderNode(child, depth + 1))}
              </div>
            )}

            {isL0 && topicData && (
              <div style={{ paddingLeft: `${indentPx + 24}px` }}>
                {topicData.loading && <LoadingOrbs />}

                {topicData.error && (
                  <div className="px-2 py-1 text-xs text-red-600">
                    {topicData.error}
                  </div>
                )}

                {!topicData.loading && !topicData.error && topicData.topics.length === 0 && (
                  <div className="px-2 py-2 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-gray-300 opacity-50" />
                    <span className="text-xs text-gray-500">No topics found</span>
                  </div>
                )}

                {!topicData.loading &&
                  !topicData.error &&
                  topicData.topics.length > 0 && (
                    <div className="space-y-1">
                      {topicData.topics.map((topic) => (
                        <div
                          key={topic.id}
                          className="px-2 py-1.5 hover:bg-gray-50 cursor-pointer rounded text-xs transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTopic?.(topic);
                          }}
                          style={{ color: "#8a817c" }}
                        >
                          <div className="font-medium mb-0.5 line-clamp-1">
                            {topic.id}
                          </div>
                          <div className="text-gray-600 line-clamp-2">
                            {topic.text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div
        ref={treeRef}
        role="tree"
        className="flex-1 overflow-y-auto px-3 py-2 min-h-0 sidebar-scroll"
        tabIndex={0}
        onFocus={() => {
          if (!focusedId && data.length > 0) {
            setFocusedId(data[0]?.id ?? null);
          }
        }}
      >
        {data.length === 0 ? (
          <div className="text-sm p-4 text-center" style={{ color: "#8a817c" }}>
            <div className="w-3 h-3 rounded-full bg-gray-300 opacity-50 mx-auto mb-2" />
            No clusters found
          </div>
        ) : (
          <div className="relative">{data.map((node) => renderNode(node))}</div>
        )}
      </div>
      <SyncToggle onResetRequest={handleResetRequest} rootData={rootData} />
    </div>
  );
});

export default ClusterTree;
