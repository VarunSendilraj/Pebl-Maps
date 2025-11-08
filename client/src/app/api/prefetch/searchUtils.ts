import MiniSearch from "minisearch";

// Utilities to enable full-text search over the OpenClio index (~1k entries).
interface Trace {
    id: string;
    description: string;
    trace: string;
}
let tracesCache: Trace[] = [];
let miniSearch: MiniSearch<Trace> | null = null;

export function isPrefetched() {
    return miniSearch !== null;
}

// Utility function to populate the traces cache with prefetched traces.
export function populateTraces(traces: Trace[]) {
    tracesCache = traces;
    // Initializing the MiniSearch object for fts.
    miniSearch = new MiniSearch({
        fields: ["id", "trace", "description"],
        storeFields: ["id", "description"],
    });
    miniSearch.addAll(tracesCache);
    console.log(`MiniSearch object initialized with ${tracesCache.length} traces`);
}

export function searchTraces(query: string) {
    if (miniSearch === null) {
        throw new Error("MiniSearch object not initialized");
    }
    let results = miniSearch.search(query, {
        boost: {
            id: 2,
            trace: 1,
            description: 1,
        }
    });
    console.log(`searchTraces results: ${results}`);
    return results;
}