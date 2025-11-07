"use client";

import { useEffect, useState } from "react";
import BubbleCanvas from "~/components/bubbles/BubbleCanvas";
import { dummyClusterData } from "~/lib/bubbles/dummyData";
import { fetchClusters } from "~/lib/bubbles/api";
import type { ClusterNode } from "~/lib/bubbles/types";
import TraceAgent from "~/components/TraceAgent";

export default function HomePage() {
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
    <main className="flex min-h-screen h-screen flex-row items-stretch bg-background text-foreground">
      <div className="flex w-[10%] items-center justify-center border-2 border-tertiary bg-tertiary/20 m-4 rounded-lg shadow-md">
        <span className="text-center w-full font-semibold">Left<br />10%</span>
      </div>
      <div className="flex w-[65%] flex-col m-4" style={{ backgroundColor: '#f0f0eb' }}>
        {isLoading && (
          <div className="flex items-center justify-center h-full">
            <p className="text-slate-600">Loading clusters...</p>
          </div>
        )}
        {error && (
          <div className="p-2 text-xs text-late-500">
            Warning: {error} (using dummy data)
          </div>
        )}
        <BubbleCanvas data={clusterData} />
      </div>
      <div className="flex w-[25%] items-center justify-center border-2 border-gray-300 bg-gray-100 m-4 rounded-lg shadow-md">
        <TraceAgent />
      </div>
    </main>
  );
}
