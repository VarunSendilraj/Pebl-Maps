"use client";

import React, { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type CanvasTab = { 
  id: string; 
  kind: 'map' | 'trace'; 
  label: string; 
  traceId?: string 
};

export interface TabsContextType {
  tabs: CanvasTab[];
  activeTabId: string;
  openTraceTab: (traceId: string, label: string) => void;
  activateTab: (tabId: string) => void;
  closeTab: (tabId: string) => void;
}

const TabsContext = createContext<TabsContextType | undefined>(undefined);

const initialTabs: CanvasTab[] = [{ id: 'map', kind: 'map', label: 'Map' }];

export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<CanvasTab[]>(initialTabs);
  const [activeTabId, setActiveTabId] = useState<string>('map');

  const openTraceTab = useCallback((traceId: string, label: string) => {
    setTabs((prevTabs) => {
      // Check if trace tab already exists
      const existingTab = prevTabs.find(tab => tab.traceId === traceId);
      if (existingTab) {
        // Activate existing tab
        setActiveTabId(existingTab.id);
        return prevTabs;
      }
      
      // Create new trace tab
      const newTab: CanvasTab = {
        id: `trace-${traceId}`,
        kind: 'trace',
        label: label.length > 30 ? `${label.substring(0, 30)}...` : label,
        traceId: traceId,
      };
      
      setActiveTabId(newTab.id);
      return [...prevTabs, newTab];
    });
  }, []);

  const activateTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    // Prevent closing the Map tab
    if (tabId === 'map') {
      return;
    }
    
    setTabs((prevTabs) => {
      const newTabs = prevTabs.filter(tab => tab.id !== tabId);
      
      // If we closed the active tab, switch to Map tab
      if (activeTabId === tabId) {
        setActiveTabId('map');
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  const value: TabsContextType = {
    tabs,
    activeTabId,
    openTraceTab,
    activateTab,
    closeTab,
  };

  return (
    <TabsContext.Provider value={value}>
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs(): TabsContextType {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("useTabs must be used within a TabsProvider");
  }
  return context;
}

