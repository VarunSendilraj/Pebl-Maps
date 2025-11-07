# Navigation Context Integration

This directory contains utilities for accessing and formatting the global navigation state, particularly useful for integrating with chat/agent features.

## Overview

The `NavigationContext` tracks the user's current position within the cluster visualization hierarchy. This context can be passed to LLM agents to provide awareness of what the user is viewing.

## Quick Start

### In a Component

```tsx
import { useNavigationState, useNavigationContext } from "~/contexts/NavigationContext";
import { formatNavigationAsNaturalLanguage } from "~/lib/navigation/chatContext";

function MyChatComponent() {
  const navigationState = useNavigationState();
  const contextSummary = useNavigationContext(); // Already formatted string
  
  // Or format it yourself for more control
  const customContext = formatNavigationAsNaturalLanguage(navigationState);
  
  // Use in chat message
  const messageWithContext = `${contextSummary}\n\nUser question: ${userInput}`;
}
```

## Available Hooks

### From `NavigationContext`

- **`useNavigation()`**: Get full context (state + actions)
- **`useNavigationState()`**: Get read-only state
- **`useNavigationActions()`**: Get actions only
- **`useNavigationContext()`**: Get formatted context string (ready to use)

### State Structure

```typescript
interface NavigationState {
  selectedNodeId: string | null;           // Currently highlighted node
  currentRootId: string | null;            // Root node ID being displayed
  currentRootNode: ClusterNode | null;     // Full root node data
  breadcrumbPath: ClusterNode[];           // Path from root to current
  expandedL0NodeIds: Set<string>;          // Expanded L0 nodes in tree
  lastUpdated: number;                     // Timestamp of last change
}
```

### Actions

```typescript
interface NavigationActions {
  selectNode: (nodeId: string | null) => void;
  navigateToRoot: (rootNode: ClusterNode, breadcrumbPath: ClusterNode[]) => void;
  toggleL0Expansion: (nodeId: string) => void;
  reset: () => void;
  getContextSummary: () => string;
}
```

## Utility Functions (chatContext.ts)

### `formatNavigationForAPI(state)`

Returns structured JSON suitable for API calls:

```typescript
{
  currentView: "Technical Issues",
  selectedNode: "l1-5-2",
  navigationPath: ["Root", "Technical Issues"],
  viewDetails: {
    type: "l1",
    traceCount: 245,
    depth: 1
  }
}
```

### `formatNavigationAsNaturalLanguage(state)`

Returns human-readable context string:

```
[Current Context]
User is viewing: "Technical Issues" (l2 cluster)
Navigation path: Root > Technical Issues
Currently selected: "API Errors" (l1 cluster)
This cluster contains 245 conversation traces
```

### `getShortContextString(state)`

Returns concise context tag:

```
@current-view: Technical Issues > API Errors
```

### `getCurrentClusterLevel(state)`

Returns the current cluster level: `'root' | 'l2' | 'l1' | 'l0'`

### `isDeepNavigation(state)`

Returns `true` if user is 2+ levels deep (useful for suggesting navigation actions)

## Chat Integration Example

Here's how you might integrate this with the TraceAgent:

```tsx
import { useNavigationState } from "~/contexts/NavigationContext";
import { formatNavigationAsNaturalLanguage, formatNavigationForAPI } from "~/lib/navigation/chatContext";

function TraceAgent() {
  const navigationState = useNavigationState();
  
  const handleChatMessage = async (userMessage: string) => {
    // Option 1: Add context as natural language in the message
    const contextualMessage = `${formatNavigationAsNaturalLanguage(navigationState)}\n\n${userMessage}`;
    
    // Option 2: Pass as structured data to API
    const response = await fetch("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message: userMessage,
        context: formatNavigationForAPI(navigationState)
      })
    });
    
    // Now the agent knows:
    // - What cluster the user is viewing
    // - What they have selected
    // - How deep they've navigated
    // - How many traces are in the current view
  };
}
```

## Use Cases

### 1. Context-Aware Chat Responses

```tsx
// User asks: "What's the main issue here?"
// Agent sees they're viewing "API Errors" cluster
// Agent responds: "In the API Errors cluster you're viewing, the main issues are..."
```

### 2. Smart Suggestions

```tsx
const level = getCurrentClusterLevel(navigationState);
if (level === 'l2') {
  suggest("Drill down into a specific subcategory for more details");
} else if (isDeepNavigation(navigationState)) {
  suggest("Go back to root view for overview");
}
```

### 3. Deep Linking / Sharing

```tsx
// Generate shareable URL with navigation state
const stateParam = encodeURIComponent(JSON.stringify(
  formatNavigationForAPI(navigationState)
));
const shareUrl = `${window.location.origin}?nav=${stateParam}`;
```

### 4. Analytics

```tsx
// Track user navigation patterns
useEffect(() => {
  analytics.track("navigation_change", {
    level: getCurrentClusterLevel(navigationState),
    depth: navigationState.breadcrumbPath.length,
    timestamp: navigationState.lastUpdated
  });
}, [navigationState.lastUpdated]);
```

## Future Enhancements

- [ ] Add session storage persistence
- [ ] Implement URL-based deep linking
- [ ] Add navigation history (back/forward)
- [ ] Track user paths for analytics
- [ ] Add keyboard shortcuts for navigation actions
