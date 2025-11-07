"use client";

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import type { ClusterNode } from "~/lib/bubbles/types";

/**
 * Navigation state tracks the current user's position and focus within the cluster visualization
 */
export interface NavigationState {
  // Currently selected/focused node (highlighted with pulsing effect)
  selectedNodeId: string | null;
  
  // The node currently being displayed as root in BubbleCanvas
  currentRootId: string | null;
  
  // The full ClusterNode being displayed as root (includes children data)
  currentRootNode: ClusterNode | null;
  
  // Path of nodes from root to current view (for breadcrumb)
  breadcrumbPath: ClusterNode[];
  
  // Set of L0 node IDs that are expanded in ClusterTree
  expandedL0NodeIds: Set<string>;
  
  // Timestamp of last state update (useful for tracking user activity)
  lastUpdated: number;
}

/**
 * Actions to manipulate navigation state
 */
export interface NavigationActions {
  // Select a node (highlights it in visualizations)
  selectNode: (nodeId: string | null) => void;
  
  // Navigate to a different root view with breadcrumb path
  navigateToRoot: (rootNode: ClusterNode, breadcrumbPath: ClusterNode[]) => void;
  
  // Toggle expansion of an L0 node in the tree view
  toggleL0Expansion: (nodeId: string) => void;
  
  // Reset to initial state (root view, nothing selected)
  reset: () => void;
  
  // Get a formatted summary of current state (for chat context)
  getContextSummary: () => string;
}

export interface NavigationContextType {
  state: NavigationState;
  actions: NavigationActions;
}

const NavigationContext = createContext<NavigationContextType | undefined>(undefined);

const initialState: NavigationState = {
  selectedNodeId: null,
  currentRootId: null,
  currentRootNode: null,
  breadcrumbPath: [],
  expandedL0NodeIds: new Set(),
  lastUpdated: Date.now(),
};

/**
 * Provider component that wraps the app and provides navigation state
 */
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<NavigationState>(initialState);

  const selectNode = useCallback((nodeId: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedNodeId: nodeId,
      lastUpdated: Date.now(),
    }));
  }, []);

  const navigateToRoot = useCallback((rootNode: ClusterNode, breadcrumbPath: ClusterNode[]) => {
    setState((prev) => ({
      ...prev,
      currentRootId: rootNode.id,
      currentRootNode: rootNode,
      breadcrumbPath,
      lastUpdated: Date.now(),
    }));
  }, []);

  const toggleL0Expansion = useCallback((nodeId: string) => {
    setState((prev) => {
      const newExpanded = new Set(prev.expandedL0NodeIds);
      if (newExpanded.has(nodeId)) {
        newExpanded.delete(nodeId);
      } else {
        newExpanded.add(nodeId);
      }
      return {
        ...prev,
        expandedL0NodeIds: newExpanded,
        lastUpdated: Date.now(),
      };
    });
  }, []);

  const reset = useCallback(() => {
    setState({
      ...initialState,
      lastUpdated: Date.now(),
    });
  }, []);

  const getContextSummary = useCallback((): string => {
    const parts: string[] = [];
    
    // Current view
    if (state.currentRootNode) {
      parts.push(`Currently viewing: ${state.currentRootNode.name} (${state.currentRootNode.type})`);
      if (state.currentRootNode.trace_count) {
        parts.push(`Trace count: ${state.currentRootNode.trace_count}`);
      }
    } else {
      parts.push("Currently viewing: Root level");
    }
    
    // Breadcrumb path
    if (state.breadcrumbPath.length > 0) {
      const pathNames = state.breadcrumbPath.map(node => node.name).join(" > ");
      parts.push(`Navigation path: ${pathNames}`);
    }
    
    // Selected node
    if (state.selectedNodeId) {
      parts.push(`Selected node: ${state.selectedNodeId}`);
    }
    
    // Expanded nodes
    if (state.expandedL0NodeIds.size > 0) {
      parts.push(`Expanded clusters: ${state.expandedL0NodeIds.size}`);
    }
    
    return parts.join("\n");
  }, [state]);

  const actions: NavigationActions = {
    selectNode,
    navigateToRoot,
    toggleL0Expansion,
    reset,
    getContextSummary,
  };

  const value: NavigationContextType = {
    state,
    actions,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * Hook to access navigation context
 * @throws Error if used outside NavigationProvider
 */
export function useNavigation(): NavigationContextType {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return context;
}

/**
 * Hook to get just the navigation state (read-only)
 */
export function useNavigationState(): NavigationState {
  const { state } = useNavigation();
  return state;
}

/**
 * Hook to get just the navigation actions
 */
export function useNavigationActions(): NavigationActions {
  const { actions } = useNavigation();
  return actions;
}

/**
 * Utility function to get current navigation context as a formatted string
 * Useful for chat integrations to understand user's current view
 */
export function useNavigationContext(): string {
  const { actions } = useNavigation();
  return actions.getContextSummary();
}
