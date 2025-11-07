"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { hierarchy, pack } from "d3-hierarchy";
import type { ClusterNode, PackedNode, ClusterType } from "~/lib/bubbles/types";
import Breadcrumb from "./Breadcrumb";
import {
  CATEGORY_COLORS,
  getGlowierShade,
  getDarkerShade,
  getTextColor,
  getBorderColor,
} from "~/lib/bubbles/colors";
import { useNavigationState, useNavigationActions } from "~/contexts/NavigationContext";

interface BubbleCanvasProps {
  data: ClusterNode | ClusterNode[];
}

interface ZoomState {
  k: number;
  x: number;
  y: number;
}

export default function BubbleCanvas({ data }: BubbleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Access navigation context
  const navigationState = useNavigationState();
  const { selectedNodeId, isSyncModeEnabled } = navigationState;
  const { selectNode, navigateToRoot } = useNavigationActions();
  
  // Normalize data to array and create synthetic root if needed
  const rootData: ClusterNode = useMemo(() => {
    return Array.isArray(data)
      ? { id: "__root__", name: "Root", type: "l2", children: data }
      : data;
  }, [data]);
  
  // Store reference to original full data tree for L2 ancestor lookup
  const originalFullData: ClusterNode = useMemo(() => {
    return Array.isArray(data)
      ? { id: "__root__", name: "Root", type: "l2" as ClusterType, children: data }
      : data;
  }, [data]);
  
  const [currentRoot, setCurrentRoot] = useState<ClusterNode>(rootData);
  const [breadcrumbPath, setBreadcrumbPath] = useState<ClusterNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<PackedNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const zoomStateRef = useRef<ZoomState>({ k: 1, x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);
  const nodesRef = useRef<PackedNode[]>([]);
  const shouldAutoZoomRef = useRef<boolean>(false);


  // Find the L2 ancestor by traversing the original data structure
  const findL2AncestorInData = (nodeId: string, dataTree: ClusterNode): ClusterNode | null => {
    // Helper to find a node and its path to root
    const findNodeWithPath = (
      tree: ClusterNode,
      targetId: string,
      path: ClusterNode[] = []
    ): { node: ClusterNode | null; path: ClusterNode[] } => {
      if (tree.id === targetId) {
        return { node: tree, path: [...path, tree] };
      }
      if (tree.children) {
        for (const child of tree.children) {
          const result = findNodeWithPath(child, targetId, [...path, tree]);
          if (result.node) {
            return result;
          }
        }
      }
      return { node: null, path: [] };
    };

    const result = findNodeWithPath(dataTree, nodeId);
    if (!result.node) return null;

    // If the node itself is L2, return it
    if (result.node.type === "l2" && result.node.id.startsWith("l2-")) {
      return result.node;
    }

    // Traverse the path backwards to find the L2 ancestor
    for (let i = result.path.length - 1; i >= 0; i--) {
      const ancestor = result.path[i];
      if (ancestor && ancestor.type === "l2" && ancestor.id.startsWith("l2-")) {
        return ancestor;
      }
    }

    return null;
  };

  // Find the L2 ancestor of a node (for use with packed nodes)
  const findL2Ancestor = (node: PackedNode): PackedNode | null => {
    // First try the parent chain (works when viewing top level)
    let current: PackedNode | undefined = node;
    while (current) {
      if (current.type === "l2" && current.id.startsWith("l2-")) {
        return current;
      }
      current = current.parent;
    }
    
    // If not found in parent chain, search in original full data structure
    const l2Ancestor = findL2AncestorInData(node.id, originalFullData);
    if (l2Ancestor) {
      // Create a minimal PackedNode representation for color lookup
      return {
        ...l2Ancestor,
        x: 0,
        y: 0,
        r: 0,
        depth: 1,
      } as PackedNode;
    }
    
    return null;
  };

  // Navigate to a specific node by ID (for external selection sync)
  const navigateToNode = useCallback((nodeId: string) => {
    // Find the node and its path in the original data tree
    const findNodeWithPath = (
      tree: ClusterNode,
      targetId: string,
      path: ClusterNode[] = []
    ): { node: ClusterNode | null; path: ClusterNode[] } => {
      if (tree.id === targetId) {
        return { node: tree, path };
      }
      if (tree.children) {
        for (const child of tree.children) {
          const result = findNodeWithPath(child, targetId, [...path, tree]);
          if (result.node) {
            return result;
          }
        }
      }
      return { node: null, path: [] };
    };

    const result = findNodeWithPath(rootData, nodeId);
    if (!result.node) {
      console.warn(`Node with id ${nodeId} not found`);
      return;
    }

    const targetNode = result.node;
    // Filter out the synthetic __root__ node from the path
    const pathToNode = result.path.filter(node => node.id !== "__root__");

    // If the node has children, navigate to it (make it the currentRoot)
    // Otherwise, navigate to its parent and highlight the node
    if (targetNode.children && targetNode.children.length > 0) {
      // Navigate to this node
      const newPath = [...pathToNode, targetNode];
      setBreadcrumbPath(newPath);
      setCurrentRoot(targetNode);
      navigateToRoot(targetNode, newPath);
      shouldAutoZoomRef.current = true;
    } else {
      // Navigate to parent and highlight this node
      if (pathToNode.length > 0) {
        const parent = pathToNode[pathToNode.length - 1];
        if (parent) {
          setBreadcrumbPath(pathToNode);
          setCurrentRoot(parent);
          navigateToRoot(parent, pathToNode);
          shouldAutoZoomRef.current = true;
        }
      } else {
        // Node is at root level
        setBreadcrumbPath([]);
        setCurrentRoot(rootData);
        navigateToRoot(rootData, []);
        shouldAutoZoomRef.current = true;
      }
    }
  }, [rootData, navigateToRoot]);

  // Get color based on L2 category and node level
  const getColor = (node: PackedNode): string => {
    // Find the L2 ancestor to determine the base color
    const l2Ancestor = findL2Ancestor(node);
    
    if (!l2Ancestor) {
      // Fallback for nodes without L2 ancestor
      return "#D1D5DB"; // Gray
    }

    const baseColor = CATEGORY_COLORS[l2Ancestor.id] || "#D1D5DB";

    // L2 nodes use the base color directly
    if (node.type === "l2" && node.depth === 1) {
      return baseColor;
    }

    // L1 and L0 nodes use a glowier shade
    return getGlowierShade(baseColor);
  };

  // Get color with alpha transparency
  const getColorAlpha = (node: PackedNode, alpha: string): string => {
    const hex = getColor(node);
    // Convert hex to RGBA
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    // Alpha is provided as hex string (e.g., "40" = 0x40 = 64/255)
    const alphaValue = parseInt(alpha, 16) / 255;
    return `rgba(${r}, ${g}, ${b}, ${alphaValue})`;
  };

  // Helper to convert hex color to RGBA with alpha
  const hexToRgba = (hex: string, alpha: string): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const alphaValue = parseInt(alpha, 16) / 255;
    return `rgba(${r}, ${g}, ${b}, ${alphaValue})`;
  };

  // Compute layout
  const computeLayout = (rootData: ClusterNode, width: number, height: number): PackedNode[] => {
    const root = hierarchy(rootData)
      .sum((d: ClusterNode) => Math.max(1, d.trace_count ?? 1))
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));

    const packLayout = pack<ClusterNode>()
      .size([width, height])
      .padding(6);

    const packed = packLayout(root);
    return packed.descendants().map((node) => {
      const base = node.data;
      return {
        ...base,
        x: node.x,
        y: node.y,
        r: node.r,
        depth: node.depth,
        value: node.value,
        parent: node.parent ? {
          ...node.parent.data,
          x: node.parent.x,
          y: node.parent.y,
          r: node.parent.r,
          depth: node.parent.depth,
          value: node.parent.value,
        } as PackedNode : undefined,
        children: node.children?.map((child) => ({
          ...child.data,
          x: child.x,
          y: child.y,
          r: child.r,
          depth: child.depth,
          value: child.value,
        })) as PackedNode[] | undefined,
      } as PackedNode;
    });
  };

  // Draw canvas
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !containerRef.current) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    // Clear background - match parent background color for seamless blending
    ctx.fillStyle = "#f0f0eb";
    ctx.fillRect(0, 0, width, height);

    // Compute layout
    const nodes = computeLayout(currentRoot, width, height);
    nodesRef.current = nodes;

    // Apply zoom transform
    const { k, x, y } = zoomStateRef.current;
    ctx.save();
    ctx.translate(width / 2, height / 2);
    ctx.scale(k, k);
    ctx.translate(-width / 2 + x, -height / 2 + y);

    // Draw circles (outer to inner) - filter out root node (depth 0)
    const visibleNodes = nodes.filter((node) => node.depth > 0); // Skip synthetic root
    
    // Determine the current level depth (direct children of currentRoot have depth 1)
    // Only show text labels for nodes at the current level (depth 1)
    const currentLevelDepth = 1;
    
    const sortedNodes = [...visibleNodes].sort((a, b) => b.depth - a.depth);
    sortedNodes.forEach((node) => {
      const isHovered = hoveredNode?.id === node.id;
      const isSelected = selectedNodeId === node.id;
      const isCurrentLevel = node.depth === currentLevelDepth;

      // Get the base color for this node
      let displayColor = getColor(node);
      
      // For non-current level nodes, use a darker shade to make them stand out
      if (!isCurrentLevel) {
        const l2Ancestor = findL2Ancestor(node);
        if (l2Ancestor) {
          const baseColor = CATEGORY_COLORS[l2Ancestor.id] || "#D1D5DB";
          // Use darker shade for non-current levels - still same color family but distinct
          displayColor = getDarkerShade(baseColor);
        }
      }

      // Opacity settings - current level gets full opacity, sublevels get softer glow
      const fillAlphaStart = isCurrentLevel ? "80" : "50";
      const fillAlphaEnd = isCurrentLevel ? "50" : "25";
      const strokeAlpha = isCurrentLevel ? "70" : "80";

      // Draw special pulsing glow for selected node
      if (isSelected) {
        const pulseTime = (Date.now() % 2000) / 2000; // 2 second cycle
        const pulseScale = 1.2 + Math.sin(pulseTime * Math.PI * 2) * 0.15; // Oscillate between 1.05 and 1.35
        const pulseAlpha = Math.floor(40 + Math.sin(pulseTime * Math.PI * 2) * 20); // Oscillate alpha
        
        const selectionGlow = ctx.createRadialGradient(
          node.x,
          node.y,
          node.r * 0.5,
          node.x,
          node.y,
          node.r * pulseScale
        );
        selectionGlow.addColorStop(0, hexToRgba(displayColor, pulseAlpha.toString(16).padStart(2, '0')));
        selectionGlow.addColorStop(1, hexToRgba(displayColor, "00"));
        
        ctx.fillStyle = selectionGlow;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r * pulseScale, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // For sublevels, draw outer glow effect first
      if (!isCurrentLevel && !isSelected) {
        // Draw outer glow layer (larger, more transparent circle)
        const glowGradient = ctx.createRadialGradient(
          node.x,
          node.y,
          node.r * 0.7,
          node.x,
          node.y,
          node.r * 1.3
        );
        glowGradient.addColorStop(0, hexToRgba(displayColor, "30"));
        glowGradient.addColorStop(1, hexToRgba(displayColor, "00"));
        
        ctx.fillStyle = glowGradient;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.r * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw main circle with gradient using the display color
      const gradient = ctx.createRadialGradient(
        node.x,
        node.y,
        0,
        node.x,
        node.y,
        node.r
      );
      
      // For sublevels, make the gradient more pronounced (stronger center glow)
      if (!isCurrentLevel) {
        gradient.addColorStop(0, hexToRgba(displayColor, fillAlphaStart));
        gradient.addColorStop(0.5, hexToRgba(displayColor, fillAlphaEnd));
        gradient.addColorStop(1, hexToRgba(displayColor, "10"));
      } else {
        gradient.addColorStop(0, hexToRgba(displayColor, fillAlphaStart));
        gradient.addColorStop(1, hexToRgba(displayColor, fillAlphaEnd));
      }

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.fill();

      // Draw border - special styling for selected, dotted for sublevels, solid for current level
      let borderColor: string;
      let borderWidth: number;
      
      if (isSelected) {
        // Selected node gets bright, thick border
        borderColor = displayColor;
        borderWidth = 4;
      } else if (isHovered) {
        borderColor = displayColor;
        borderWidth = 3;
      } else if (isCurrentLevel) {
        // For current level, use slightly darker shade for better differentiation
        const darkerBorder = getBorderColor(displayColor);
        borderColor = hexToRgba(darkerBorder, strokeAlpha);
        borderWidth = 2;
      } else {
        // For sublevels, use the display color with opacity
        borderColor = hexToRgba(displayColor, strokeAlpha);
        borderWidth = 2;
      }
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = borderWidth;
      
      // Use dotted line for sublevels (but not for selected or hovered)
      if (!isCurrentLevel && !isHovered && !isSelected) {
        const dashPattern = [4, 4]; // Dotted pattern
        ctx.setLineDash(dashPattern);
      } else {
        ctx.setLineDash([]); // Solid line
      }
      
      ctx.beginPath();
      ctx.arc(node.x, node.y, node.r, 0, Math.PI * 2);
      ctx.stroke();
      
      // Reset line dash
      ctx.setLineDash([]);

      // Draw label only for current level nodes and if circle is large enough
      if (isCurrentLevel && node.r > 20) {
        // Use a darker shade of the color for text to ensure legibility
        const textColor = getTextColor(displayColor);
        ctx.fillStyle = textColor;
        
        // Larger font size - proportional to circle radius
        const fontSize = Math.min(20, Math.max(14, node.r / 2.5));
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Simple text wrapping (max 2 lines)
        const words = node.name.split(" ");
        const maxWidth = node.r * 1.6;
        const lineHeight = fontSize * 1.3; // Line height proportional to font size
        
        // First pass: determine how many lines we'll have
        const lines: string[] = [];
        let currentLine = "";
        
        for (const word of words) {
          if (!word) continue;
          const testLine = currentLine + (currentLine ? " " : "") + word;
          const metrics = ctx.measureText(testLine);
          if (metrics.width > maxWidth && currentLine) {
            lines.push(currentLine);
            currentLine = word;
            if (lines.length >= 2) break; // Max 2 lines
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine && lines.length < 2) {
          lines.push(currentLine);
        }

        // Calculate total height and center vertically
        const totalHeight = (lines.length - 1) * lineHeight;
        const startY = node.y - totalHeight / 2;

        // Draw each line, centered
        lines.forEach((line, index) => {
          ctx.fillText(line, node.x, startY + index * lineHeight);
        });
      }
    });

    ctx.restore();
  };

  // Hit testing
  const getNodeAt = (x: number, y: number): PackedNode | null => {
    const { k, x: tx, y: ty } = zoomStateRef.current;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return null;

    // Transform mouse coordinates to canvas space
    const canvasX = (x - rect.left - rect.width / 2) / k + rect.width / 2 - tx;
    const canvasY = (y - rect.top - rect.height / 2) / k + rect.height / 2 - ty;

    // Check nodes from smallest to largest (so we get the topmost) - filter out root
    const sortedNodes = [...nodesRef.current]
      .filter((node) => node.depth > 0)
      .sort((a, b) => a.r - b.r);
    for (const node of sortedNodes) {
      const distance = Math.sqrt(
        Math.pow(canvasX - node.x, 2) + Math.pow(canvasY - node.y, 2)
      );
      if (distance <= node.r) {
        return node;
      }
    }
    return null;
  };

  // Zoom animation
  const animateZoom = (targetK: number, targetX: number, targetY: number) => {
    const startK = zoomStateRef.current.k;
    const startX = zoomStateRef.current.x;
    const startY = zoomStateRef.current.y;
    const startTime = performance.now();
    const duration = 900; // ms - slightly longer for smoother feel

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic

      zoomStateRef.current.k = startK + (targetK - startK) * ease;
      zoomStateRef.current.x = startX + (targetX - startX) * ease;
      zoomStateRef.current.y = startY + (targetY - startY) * ease;

      draw();

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Ensure we end exactly at the target
        zoomStateRef.current.k = targetK;
        zoomStateRef.current.x = targetX;
        zoomStateRef.current.y = targetY;
        draw();
        animationFrameRef.current = null;
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Calculate zoom to fit all visible nodes
  const calculateFitZoom = (nodes: PackedNode[], width: number, height: number): { k: number; x: number; y: number } => {
    // Filter out root node and get visible nodes
    const visibleNodes = nodes.filter((node) => node.depth > 0);
    if (visibleNodes.length === 0) {
      return { k: 1, x: 0, y: 0 };
    }

    // Find bounding box of all nodes
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    visibleNodes.forEach((node) => {
      minX = Math.min(minX, node.x - node.r);
      maxX = Math.max(maxX, node.x + node.r);
      minY = Math.min(minY, node.y - node.r);
      maxY = Math.max(maxY, node.y + node.r);
    });

    const boundsWidth = maxX - minX;
    const boundsHeight = maxY - minY;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // Calculate zoom to fit with padding (10% on each side)
    const padding = 0.1;
    const scaleX = (width * (1 - padding * 2)) / boundsWidth;
    const scaleY = (height * (1 - padding * 2)) / boundsHeight;
    const targetK = Math.min(scaleX, scaleY, 1); // Don't zoom in beyond 1x

    // Center the bounds in the viewport
    // The transform applies: translate(w/2, h/2) -> scale(k) -> translate(-w/2 + x, -h/2 + y)
    // For a canvas point (centerX, centerY) to appear at screen center (w/2, h/2):
    // Final screen position = (centerX * k + x, centerY * k + y)
    // Setting this equal to (w/2, h/2) gives us:
    // x = w/2 - centerX * k
    // y = h/2 - centerY * k
    const targetX = (width / 2) - centerX * targetK;
    const targetY = (height / 2) - centerY * targetK;

    return { k: targetK, x: targetX, y: targetY };
  };

  // Handle click
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const node = getNodeAt(e.clientX, e.clientY);
    if (!node) return;

    // Check if node has children
    const hasChildren = node.children && node.children.length > 0;
    if (!hasChildren) return;

    // Find the ClusterNode in the current root
    const findNode = (n: ClusterNode, id: string): ClusterNode | null => {
      if (n.id === id) return n;
      if (n.children) {
        for (const child of n.children) {
          const found = findNode(child, id);
          if (found) return found;
        }
      }
      return null;
    };

    const clusterNode = findNode(currentRoot, node.id);
    if (!clusterNode || !clusterNode.children) return;

    // Update breadcrumb - add the clicked node (clusterNode) to the path
    // The breadcrumb represents the path TO the current view
    const newBreadcrumbPath = [...breadcrumbPath, clusterNode];

    // Update context with selection and navigation
    selectNode(node.id);
    navigateToRoot(clusterNode, newBreadcrumbPath);

    // Update state and trigger auto-zoom
    setBreadcrumbPath(newBreadcrumbPath);
    shouldAutoZoomRef.current = true;
    setCurrentRoot(clusterNode);
  };

  // Handle mouse move
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const node = getNodeAt(e.clientX, e.clientY);
    setHoveredNode(node);
    if (node) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }
    } else {
      setTooltipPos(null);
    }
  };

  // Handle breadcrumb navigation
  const handleBreadcrumbClick = (index: number) => {
    if (index === -1) {
      // Root
      setCurrentRoot(rootData);
      setBreadcrumbPath([]);
      navigateToRoot(rootData, []);
      shouldAutoZoomRef.current = true;
    } else {
      const targetNode = breadcrumbPath[index];
      if (!targetNode) return;
      
      const newPath = breadcrumbPath.slice(0, index + 1);
      setBreadcrumbPath(newPath);
      navigateToRoot(targetNode, newPath);
      shouldAutoZoomRef.current = true;
      setCurrentRoot(targetNode);
    }
  };

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      draw();
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, []);

  // Reset when rootData changes
  useEffect(() => {
    setCurrentRoot(rootData);
    setBreadcrumbPath([]);
    navigateToRoot(rootData, []);
    selectNode(null);
    zoomStateRef.current = { k: 1, x: 0, y: 0 };
    shouldAutoZoomRef.current = false;
    
    // Calculate initial fit zoom - use double requestAnimationFrame to ensure container is fully sized
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          const initialNodes = computeLayout(rootData, rect.width, rect.height);
          const fitZoom = calculateFitZoom(initialNodes, rect.width, rect.height);
          zoomStateRef.current = fitZoom;
          draw();
        }
      });
    });
  }, [rootData]);

  // Auto-zoom when currentRoot changes (if triggered by user interaction)
  useEffect(() => {
    if (!shouldAutoZoomRef.current) {
      draw();
      return;
    }

    shouldAutoZoomRef.current = false;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      draw();
      return;
    }

    // Calculate layout and zoom for the new root
    const newNodes = computeLayout(currentRoot, rect.width, rect.height);
    const fitZoom = calculateFitZoom(newNodes, rect.width, rect.height);
    animateZoom(fitZoom.k, fitZoom.x, fitZoom.y);
  }, [currentRoot]);

  // Redraw when hover changes
  useEffect(() => {
    draw();
  }, [hoveredNode]);

  // Handle external selection changes from ClusterTree (only if sync mode is enabled)
  useEffect(() => {
    if (selectedNodeId && isSyncModeEnabled) {
      navigateToNode(selectedNodeId);
    }
  }, [selectedNodeId, isSyncModeEnabled, navigateToNode]);

  // Continuous animation loop for pulsing selected node
  useEffect(() => {
    if (!selectedNodeId) return;
    
    let animationId: number;
    const animate = () => {
      draw();
      animationId = requestAnimationFrame(animate);
    };
    
    animationId = requestAnimationFrame(animate);
    
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
    };
  }, [selectedNodeId, currentRoot, hoveredNode]);

  // Cleanup animation frame
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <div className="w-full h-full flex flex-col">
      <Breadcrumb
        path={breadcrumbPath}
        currentRoot={currentRoot}
        onNavigate={handleBreadcrumbClick}
        onRoot={() => handleBreadcrumbClick(-1)}
      />
      <div ref={containerRef} className="relative w-full flex-1 min-h-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            setHoveredNode(null);
            setTooltipPos(null);
          }}
          className="w-full h-full cursor-pointer"
        />
        {hoveredNode && tooltipPos && (
          <div
            className="absolute pointer-events-none bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg z-10"
            style={{
              left: `${tooltipPos.x + 10}px`,
              top: `${tooltipPos.y - 10}px`,
              transform: "translateY(-100%)",
            }}
          >
            <div className="font-semibold">{hoveredNode.name}</div>
            {hoveredNode.trace_count !== undefined && (
              <div className="text-slate-300">
                {hoveredNode.trace_count} {hoveredNode.trace_count === 1 ? "trace" : "traces"}
              </div>
            )}
          </div>
        )}
      </div>
      {breadcrumbPath.length > 0 && (
        <p className="mt-2 text-xs text-slate-500">
          Click any circle with child items to zoom in
        </p>
      )}
    </div>
  );
}

