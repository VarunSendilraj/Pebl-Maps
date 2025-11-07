"use client";

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface TraceContextType {
  selectedTraceId: string | null;
  selectTrace: (traceId: string | null) => void;
  clearSelection: () => void;
}

const TraceContext = createContext<TraceContextType | undefined>(undefined);

export function TraceProvider({ children }: { children: ReactNode }) {
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
 
  const selectTrace = useCallback((traceId: string | null) => {
    setSelectedTraceId(traceId);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedTraceId(null);
  }, []);

  const value: TraceContextType = {
    selectedTraceId,
    selectTrace,
    clearSelection,
  };

  return (
    <TraceContext.Provider value={value}>
      {children}
    </TraceContext.Provider>
  );
}

export function useTrace(): TraceContextType {
  const context = useContext(TraceContext);
  if (!context) {
    throw new Error("useTrace must be used within a TraceProvider");
  }
  return context;
}
