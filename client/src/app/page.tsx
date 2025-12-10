"use client";

import { useEffect, useState } from "react";
import BubbleCanvas from "~/components/bubbles/BubbleCanvas";
import { fetchClusters } from "~/lib/bubbles/api";
import type { ClusterNode, TopicSummary } from "~/lib/bubbles/types";
import TraceAgent from "~/components/TraceAgent";
import ClusterTree from "~/components/cluster-tree/ClusterTree";
import { NavigationProvider, useNavigationActions } from "~/contexts/NavigationContext";
import { TraceProvider } from "~/contexts/TraceContext";
import { TabsProvider, useTabs } from "~/contexts/TabsContext";
import { UIProvider } from "~/contexts/UIContext";
import { EvalProvider } from "~/contexts/EvalContext";
import CanvasTabs from "~/components/CanvasTabs";
import TraceTabContent from "~/components/TraceTabContent";
import Workspace from "~/components/layout/Workspace";
import Sidebar from "~/components/sidebar/Sidebar";
import Rightbar from "~/components/sidebar/Rightbar";

function HomePageContent() {
  const [clusterData, setClusterData] = useState<ClusterNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectNode } = useNavigationActions();
  const { tabs, activeTabId, openTraceTab } = useTabs();

  const activeTab = tabs.find(tab => tab.id === activeTabId) || tabs[0];

  useEffect(() => {
    console.log("Prefetching traces...");
    fetch("/api/prefetch")
      .then(res => res.json())
      .then(async (data) => {
        if (data) {
          const { populateCache } = await import("~/app/api/prefetch/searchUtils");
          populateCache(data);
          console.log("Traces prefetched");
        }
      })
      .catch(err => console.error("Failed to prefetch traces:", err));

    async function loadClusters() {
      try {
        setIsLoading(true);
        setError(null);
        const clusters = await fetchClusters();
        setClusterData(clusters);
      } catch (err) {
        console.error("Failed to load clusters:", err);
        setError(err instanceof Error ? err.message : "Failed to load clusters");
        setClusterData([]);
      } finally {
        setIsLoading(false);
      }
    }

    loadClusters();
  }, []);

  const handleTopicSelect = (topic: TopicSummary) => {
    console.log("Selected topic:", topic);
    // Open trace tab when topic is clicked in ClusterTree
    openTraceTab(topic.id, topic.text);
  };

  const handleNodeSelect = (node: ClusterNode) => {
    console.log("Selected node:", node);
    selectNode(node.id);
  };

  return (
    <main className="flex min-h-screen h-screen flex-row items-stretch bg-background text-foreground">
      <Workspace
        sidebar={
          <Sidebar>
            <div
              className="flex flex-col h-full overflow-hidden"
              style={{
                backgroundColor: '#e5e0d8',
                borderTop: '1px solid #d8d3cb',
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="w-8 h-8 border-2 border-slate-200 rounded-full border-t-slate-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs text-slate-600">Loading...</p>
                  </div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center h-full p-4">
                  <p className="text-xs text-red-600 text-center">{error}</p>
                </div>
              ) : (
                <ClusterTree
                  data={clusterData}
                  onSelectTopic={handleTopicSelect}
                  onSelectNode={handleNodeSelect}
                />
              )}
            </div>
          </Sidebar>
        }
        editor={
          <>
            <CanvasTabs />
            <div className="flex-1 overflow-hidden">
              {activeTab.kind === 'map' ? (
                <>
                  {isLoading && (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative w-16 h-16">
                          <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-200 rounded-full"></div>
                          <div className="absolute top-0 left-0 w-full h-full border-4 border-slate-600 rounded-full border-t-transparent animate-spin"></div>
                        </div>
                        <p className="text-slate-600 font-medium">Loading clusters...</p>
                      </div>
                    </div>
                  )}
                  {!isLoading && error && (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-red-600 font-medium">Error: {error}</p>
                    </div>
                  )}
                  {!isLoading && !error && clusterData.length === 0 && (
                    <div className="flex items-center justify-center h-full">
                      <p className="text-slate-600 font-medium text-lg">Nothing found</p>
                    </div>
                  )}
                  {!isLoading && !error && clusterData.length > 0 && (
                    <BubbleCanvas data={clusterData} />
                  )}
                </>
              ) : (
                <TraceTabContent traceId={activeTab.traceId!} />
              )}
            </div>
          </>
        }
        rightbar={
          <Rightbar>
            <div
              className="flex flex-col h-full overflow-hidden"
              style={{
                backgroundColor: '#e5e0d8',
                borderTop: '1px solid #d8d3cb',
              }}
            >
              <TraceAgent />
            </div>
          </Rightbar>
        }
      />
    </main>
  );
}

export default function HomePage() {
  return (
    <NavigationProvider>
      <TraceProvider>
        <TabsProvider>
          <UIProvider>
            <EvalProvider>
              <HomePageContent />
            </EvalProvider>
          </UIProvider>
        </TabsProvider>
      </TraceProvider>
    </NavigationProvider>
  );
}
