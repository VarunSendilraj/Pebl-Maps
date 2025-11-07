/**
 * Utility functions for integrating navigation context with chat/agent features
 * 
 * These functions help format the current navigation state into context
 * that can be passed to LLM agents for better understanding of user's view.
 */

import type { NavigationState } from "~/contexts/NavigationContext";

/**
 * Format navigation state as a structured object for API calls
 * Useful for passing as context to backend APIs or OpenAI agents
 */
export function formatNavigationForAPI(state: NavigationState): {
  currentView: string | null;
  selectedNode: string | null;
  navigationPath: string[];
  viewDetails: {
    type: string | null;
    traceCount: number | null;
    depth: number;
  };
} {
  return {
    currentView: state.currentRootNode?.name ?? null,
    selectedNode: state.selectedNodeId,
    navigationPath: state.breadcrumbPath.map(node => node.name),
    viewDetails: {
      type: state.currentRootNode?.type ?? null,
      traceCount: state.currentRootNode?.trace_count ?? null,
      depth: state.breadcrumbPath.length,
    },
  };
}

/**
 * Format navigation state as a natural language string for LLM context
 * This can be prepended to chat messages to give the LLM awareness of current view
 * 
 * Example output:
 * ```
 * [Current Context]
 * User is viewing: "Technical Issues" (l2 cluster)
 * Navigation path: Root > Technical Issues
 * Currently selected: "API Errors" (l1 cluster)
 * This cluster contains 245 conversation traces
 * ```
 */
export function formatNavigationAsNaturalLanguage(state: NavigationState): string {
  const lines: string[] = ["[Current Context]"];
  
  // Current view
  if (state.currentRootNode) {
    lines.push(
      `User is viewing: "${state.currentRootNode.name}" (${state.currentRootNode.type} cluster)`
    );
  } else {
    lines.push("User is viewing: Root level (all clusters)");
  }
  
  // Navigation path
  if (state.breadcrumbPath.length > 0) {
    const pathStr = ["Root", ...state.breadcrumbPath.map(n => n.name)].join(" > ");
    lines.push(`Navigation path: ${pathStr}`);
  }
  
  // Selected node
  if (state.selectedNodeId && state.currentRootNode) {
    // Try to find the selected node name
    const findNodeName = (nodeId: string): string | null => {
      if (state.currentRootNode?.id === nodeId) {
        return state.currentRootNode.name;
      }
      // Could recursively search children here if needed
      return null;
    };
    
    const selectedName = findNodeName(state.selectedNodeId);
    if (selectedName) {
      lines.push(`Currently selected: "${selectedName}"`);
    }
  }
  
  // Trace count
  if (state.currentRootNode?.trace_count) {
    lines.push(
      `This cluster contains ${state.currentRootNode.trace_count} conversation trace${
        state.currentRootNode.trace_count === 1 ? "" : "s"
      }`
    );
  }
  
  return lines.join("\n");
}

/**
 * Get a concise context string suitable for chat message prefix
 * Example: "@current-view: Technical Issues > API Errors"
 */
export function getShortContextString(state: NavigationState): string {
  if (state.breadcrumbPath.length === 0 && !state.currentRootNode) {
    return "@current-view: Root";
  }
  
  const path = state.breadcrumbPath.map(n => n.name);
  if (state.currentRootNode && state.currentRootNode.id !== "__root__") {
    path.push(state.currentRootNode.name);
  }
  
  return `@current-view: ${path.join(" > ")}`;
}

/**
 * Check if user is deep in the navigation hierarchy
 * Useful for suggesting "go back to root" or similar actions
 */
export function isDeepNavigation(state: NavigationState): boolean {
  return state.breadcrumbPath.length >= 2;
}

/**
 * Get the cluster level the user is currently viewing
 * Returns 'root', 'l2', 'l1', or 'l0'
 */
export function getCurrentClusterLevel(state: NavigationState): 'root' | 'l2' | 'l1' | 'l0' {
  if (!state.currentRootNode || state.currentRootNode.id === "__root__") {
    return 'root';
  }
  
  return state.currentRootNode.type;
}
