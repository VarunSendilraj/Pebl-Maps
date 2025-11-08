import MiniSearch from "minisearch";

// Utilities to enable full-text search over the OpenClio index (~1k entries).
export interface Trace {
    id: string;
    description: string;
    trace: string;
}
export interface Cluster {
    id: string;
    name: string;
    description: string;
    l2ClusterId?: number;
}

// Unified searchable item that can represent both traces and clusters
export interface SearchableItem {
    id: string;
    type: "trace" | "l0Cluster" | "l1Cluster" | "l2Cluster";
    // Combined searchable text for indexing
    searchableText: string;
    // Display description (trace.description or cluster.name)
    description: string;
    // L2 cluster ID for color determination (clusters only)
    l2ClusterId?: number;
}

export interface Cache {
    traces: Trace[];
    l2Clusters: Cluster[];
    l1Clusters: Cluster[];
    l0Clusters: Cluster[];
}

// Initializing an empty cache, for now.
let cache: Cache | null = null;
let miniSearch: MiniSearch<SearchableItem> | null = null;

export function isPrefetched() {
    return miniSearch !== null;
}

// Convert traces and clusters to unified searchable items
function toSearchableItems(cache: Cache): SearchableItem[] {
    const items: SearchableItem[] = [];

    // Add traces
    cache.traces.forEach(trace => {
        items.push({
            id: trace.id,
            type: "trace",
            searchableText: `${trace.description} ${trace.trace}`,
            description: trace.description || trace.id,
        });
    });

    // Add clusters from all levels with their specific types
    cache.l0Clusters.forEach(cluster => {
        items.push({
            id: cluster.id,
            type: "l0Cluster",
            searchableText: `${cluster.name} ${cluster.description}`,
            description: cluster.name || cluster.description,
            l2ClusterId: cluster.l2ClusterId,
        });
    });

    cache.l1Clusters.forEach(cluster => {
        items.push({
            id: cluster.id,
            type: "l1Cluster",
            searchableText: `${cluster.name} ${cluster.description}`,
            description: cluster.name || cluster.description,
            l2ClusterId: cluster.l2ClusterId,
        });
    });

    cache.l2Clusters.forEach(cluster => {
        items.push({
            id: cluster.id,
            type: "l2Cluster",
            searchableText: `${cluster.name} ${cluster.description}`,
            description: cluster.name || cluster.description,
            l2ClusterId: cluster.l2ClusterId,
        });
    });

    return items;
}

// Utility function to populate the cache with prefetched data.
export function populateCache(input: Cache) {
    cache = input;

    // Convert to unified searchable items
    const searchableItems = toSearchableItems(cache);

    // Initialize MiniSearch with unified fields
    miniSearch = new MiniSearch<SearchableItem>({
        fields: ["id", "searchableText"],
        storeFields: ["id", "type", "description", "l2ClusterId"],
    });

    miniSearch.addAll(searchableItems);
    console.log(`MiniSearch initialized with ${searchableItems.length} items (${cache.traces.length} traces, ${cache.l0Clusters.length + cache.l1Clusters.length + cache.l2Clusters.length} clusters)`);
}

// Unified search function that searches both traces and clusters
export function searchAll(query: string, options?: { type?: "trace" | "l0Cluster" | "l1Cluster" | "l2Cluster" | "cluster" }) {
    if (miniSearch === null) {
        throw new Error("MiniSearch object not initialized");
    }

    let results = miniSearch.search(query, {
        boost: {
            id: 3,
            searchableText: 1,
        }
    });

    // Filter by type if specified
    if (options?.type) {
        if (options.type === "cluster") {
            // Filter for all cluster types
            results = results.filter(r => r.type === "l0Cluster" || r.type === "l1Cluster" || r.type === "l2Cluster");
        } else {
            results = results.filter(r => r.type === options.type);
        }
    }

    return results;
}

// Convenience function for backward compatibility
export function searchTraces(query: string) {
    return searchAll(query, { type: "trace" });
}

// New function to search clusters (all levels)
export function searchClusters(query: string) {
    return searchAll(query, { type: "cluster" });
}