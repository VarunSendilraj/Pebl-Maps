"use client";

import { useEffect, useState } from "react";
import BubbleCanvas from "~/components/bubbles/BubbleCanvas";
import { dummyClusterData } from "~/lib/bubbles/dummyData";
import { fetchClusters } from "~/lib/bubbles/api";
import type { ClusterNode } from "~/lib/bubbles/types";

export default function BubblesTestPage() {
  const [clusterData, setClusterData] = useState<ClusterNode[]>(dummyClusterData);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadClusters() {
      try {
        setIsLoading(true);
        setError(null);
        const clusters = await fetchClusters();
        setClusterData(clusters);
      } catch (err) {
        console.error("Failed to load clusters, using dummy data:", err);
        setError(err instanceof Error ? err.message : "Failed to load clusters");
        // Keep dummy data as fallback
        setClusterData(dummyClusterData);
      } finally {
        setIsLoading(false);
      }
    }

    loadClusters();
  }, []);

  return (
    <main className="min-h-screen w-full bg-background p-8">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="mb-6 text-3xl font-bold text-foreground">Bubble Canvas Test Page</h1>
        {isLoading && (
          <div className="mb-4 text-slate-600">Loading clusters...</div>
        )}
        {error && (
          <div className="mb-4 p-2 text-xs text-late-500">
            Warning: {error} (using dummy data)
          </div>
        )}
        <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-lg" style={{ height: '600px' }}>
          <BubbleCanvas data={clusterData} />
        </div>
      </div>
    </main>
  );
}

