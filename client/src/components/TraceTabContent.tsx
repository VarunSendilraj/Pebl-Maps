"use client";

import { useEffect, useState } from "react";
import { useTabs } from "~/contexts/TabsContext";
import UserIcon from "~/components/UserIcon";
import AssistantIcon from "~/components/AssistantIcon";

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
    l2_cluster_id?: number;
    l0_cluster_id?: number;
    l1_cluster_id?: number;
    l1_cluster_name?: string;
    country?: string;
    model?: string;
    state?: string;
    toxic?: boolean;
    [key: string]: unknown;
  };
}

export default function TraceTabContent({ traceId }: TraceTabContentProps) {
  const [traceData, setTraceData] = useState<TraceData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedMessages, setExpandedMessages] = useState<Set<string>>(new Set());
  const { updateTabClusterId } = useTabs();

  const toggleMessage = (messageId: string) => {
    setExpandedMessages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

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
        
        // Update tab with cluster ID if available
        if (data.trace?.metadata?.l2_cluster_id !== undefined) {
          updateTabClusterId(traceId, data.trace.metadata.l2_cluster_id);
        }
      } catch (err) {
        console.error("Error fetching trace data:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch trace");
      } finally {
        setIsLoading(false);
      }
    }

    fetchTrace();
  }, [traceId, updateTabClusterId]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: '#f0f0eb' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-tertiary rounded-full border-t-primary animate-spin mx-auto mb-2" />
          <p className="text-sm text-foreground/70">Loading trace...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4" style={{ backgroundColor: '#f0f0eb' }}>
        <p className="text-primary text-sm">Error: {error}</p>
      </div>
    );
  }

  if (!traceData || traceData.turns.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ backgroundColor: '#f0f0eb' }}>
        <p className="text-foreground/70 text-sm">No trace data available</p>
      </div>
    );
  }

  const MessageBox = ({ 
    content, 
    messageId, 
    icon, 
    bgColor, 
    borderColor, 
    iconBg,
    gradientFrom,
    alignRight = false
  }: { 
    content: string;
    messageId: string;
    icon: React.ReactNode;
    bgColor: string;
    borderColor: string;
    iconBg: string;
    gradientFrom: string;
    alignRight?: boolean;
  }) => {
    const isExpanded = expandedMessages.has(messageId);
    const textContent = content || '(empty)';
    const needsTruncation = textContent.length > 500 || textContent.split('\n').length > 8;
    
    return (
      <div className={`flex items-start gap-4 ${alignRight ? 'flex-row-reverse' : ''}`}>
        <div className="flex-shrink-0">
          <div className={`w-9 h-9 rounded-full ${iconBg} flex items-center justify-center text-primary shadow-sm`}>
            {icon}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <div className={`${bgColor} backdrop-blur-sm border ${borderColor} rounded-xl shadow-sm hover:shadow-md transition-all`}>
            <div className="relative">
              <div 
                className={`text-sm text-foreground whitespace-pre-wrap leading-relaxed font-sans p-5 transition-all ${
                  !isExpanded && needsTruncation ? 'max-h-48 overflow-hidden' : ''
                }`}
              >
                {textContent}
              </div>
              {!isExpanded && needsTruncation && (
                <div className={`absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t ${gradientFrom} to-transparent pointer-events-none`} />
              )}
            </div>
            {needsTruncation && (
              <button
                onClick={() => toggleMessage(messageId)}
                className="w-full px-5 pb-4 pt-2 text-xs font-medium text-primary/70 hover:text-primary transition-colors flex items-center justify-center gap-1"
              >
                {isExpanded ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                    </svg>
                    Show less
                  </>
                ) : (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                    Show more
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: '#f0f0eb' }}>
      <div className="max-w-4xl mx-auto py-8 px-6 space-y-6">
        {/* Header Section */}
        <div className="mb-6 space-y-4">
          {/* Topic ID and Description Indicator */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-block font-mono text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-md">
              {traceData.metadata.traceId}
            </span>
            <div className="flex items-center gap-2">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-3.5 h-3.5 text-primary/50"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
                />
              </svg>
              <span className="text-xs font-medium text-primary/60 uppercase tracking-wide">Description</span>
            </div>
          </div>
          
          {/* Description */}
          <p className="text-base text-foreground leading-relaxed">
            {traceData.metadata.description || 'No description available'}
          </p>

          {/* Tags Section */}
          {(traceData.metadata.country || traceData.metadata.model || traceData.metadata.state || traceData.metadata.l1_cluster_name) && (
            <div className="flex flex-wrap gap-2 pt-2">
              {traceData.metadata.country && (
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground/70 bg-tertiary/30 px-2.5 py-1 rounded-md border border-tertiary/40">
                  <span className="font-medium text-primary/70">country:</span>
                  <span>{traceData.metadata.country}</span>
                </span>
              )}
              {traceData.metadata.model && (
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground/70 bg-tertiary/30 px-2.5 py-1 rounded-md border border-tertiary/40">
                  <span className="font-medium text-primary/70">model:</span>
                  <span>{traceData.metadata.model}</span>
                </span>
              )}
              {traceData.metadata.state && (
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground/70 bg-tertiary/30 px-2.5 py-1 rounded-md border border-tertiary/40">
                  <span className="font-medium text-primary/70">state:</span>
                  <span>{traceData.metadata.state}</span>
                </span>
              )}
              {traceData.metadata.l1_cluster_name && (
                <span className="inline-flex items-center gap-1.5 text-xs text-foreground/70 bg-tertiary/30 px-2.5 py-1 rounded-md border border-tertiary/40">
                  <span className="font-medium text-primary/70">L1 Cluster:</span>
                  <span>{traceData.metadata.l1_cluster_name}</span>
                </span>
              )}
            </div>
          )}

          {/* Scores Section */}
          {traceData.metadata.toxic !== undefined && (
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-3.5 h-3.5 text-primary/50"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="text-xs font-medium text-primary/60 uppercase tracking-wide">Scores</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md border ${
                  traceData.metadata.toxic
                    ? 'bg-red-50 text-red-700 border-red-200'
                    : 'bg-green-100/60 text-green-600 border-green-200/60'
                }`}>
                  <span className="font-medium">Toxic:</span>
                  <span>{traceData.metadata.toxic ? 'True' : 'False'}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Separator with "Trace" */}
        <div className="relative flex items-center py-4">
          <div className="flex-grow border-t border-primary/10"></div>
          <span className="flex-shrink mx-4 text-xs text-primary/50 uppercase tracking-wider font-medium">Trace</span>
          <div className="flex-grow border-t border-primary/10"></div>
        </div>

        {/* Messages */}
        {traceData.turns.map((turn, index) => (
          <div key={index} className="space-y-5">
            {/* User Message */}
            <MessageBox
              content={turn.user}
              messageId={`user-${index}`}
              icon={<UserIcon />}
              bgColor="bg-white/70"
              borderColor="border-primary/15"
              iconBg="bg-primary/15"
              gradientFrom="from-white/70"
            />

            {/* Assistant Message */}
            <MessageBox
              content={turn.assistant}
              messageId={`assistant-${index}`}
              icon={<AssistantIcon />}
              bgColor="bg-white/50"
              borderColor="border-tertiary/40"
              iconBg="bg-tertiary/50"
              gradientFrom="from-white/50"
              alignRight={true}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

