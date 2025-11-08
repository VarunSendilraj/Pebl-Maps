"use client";

import { useEffect, useState } from "react";

interface TraceTabContentProps {
  traceId: string;
}

interface Turn {
  user: string;
  assistant: string;
}

interface TraceData {
  turns: Turn[];
  metadata: {
    traceId: string;
    description: string;
    [key: string]: unknown;
  };
}

export default function TraceTabContent({ traceId }: TraceTabContentProps) {
  const [traceData, setTraceData] = useState<TraceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTrace() {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(`/api/trace?traceId=${traceId}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch trace: ${response.statusText}`);
        }
        
        const data = await response.json();
        if (!data.success) {
          throw new Error(data.error || 'Failed to fetch trace data');
        }
        
        setTraceData(data.trace);
      } catch (err) {
        console.error("Error fetching trace data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch trace");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTrace();
  }, [traceId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-200 rounded-full border-t-slate-600 animate-spin mx-auto mb-2" />
          <p className="text-sm text-slate-600">Loading trace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <p className="text-red-600 text-sm">Error: {error}</p>
      </div>
    );
  }

  if (!traceData || traceData.turns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-slate-600 text-sm">No trace data available</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-4 bg-white">
      <div className="max-w-4xl mx-auto space-y-6">
        {traceData.turns.map((turn, index) => (
          <div key={index} className="border border-gray-200 rounded-lg p-4 space-y-3">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                USER
              </div>
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded border border-gray-100">
                {turn.user || '(empty)'}
              </pre>
            </div>
            
            <div className="space-y-2">
              <div className="text-xs font-semibold text-green-600 uppercase tracking-wide">
                ASSISTANT
              </div>
              <pre className="text-sm text-gray-800 whitespace-pre-wrap font-sans bg-gray-50 p-3 rounded border border-gray-100">
                {turn.assistant || '(empty)'}
              </pre>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

