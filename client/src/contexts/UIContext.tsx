"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface UIContextType {
  isSidebarOpen: boolean;
  isChatOpen: boolean;
}

interface UIActionsType {
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleChat: () => void;
  setChatOpen: (open: boolean) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);
const UIActionsContext = createContext<UIActionsType | undefined>(undefined);

const SIDEBAR_STORAGE_KEY = "ui.sidebarOpen";
const CHAT_STORAGE_KEY = "ui.chatOpen";

export function UIProvider({ children }: { children: ReactNode }) {
  // Initialize with consistent default values (same on server and client)
  // Then sync with localStorage after hydration
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isChatOpen, setIsChatOpen] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState(false);

  // Sync with localStorage after component mounts (client-side only)
  useEffect(() => {
    setIsMounted(true);
    const storedSidebar = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (storedSidebar !== null) {
      setIsSidebarOpen(storedSidebar === "true");
    }
    const storedChat = localStorage.getItem(CHAT_STORAGE_KEY);
    if (storedChat !== null) {
      setIsChatOpen(storedChat === "true");
    }
  }, []);

  // Persist sidebar to localStorage whenever state changes (only after mount)
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(isSidebarOpen));
    }
  }, [isSidebarOpen, isMounted]);

  // Persist chat to localStorage whenever state changes (only after mount)
  useEffect(() => {
    if (isMounted) {
      localStorage.setItem(CHAT_STORAGE_KEY, String(isChatOpen));
    }
  }, [isChatOpen, isMounted]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((prev) => !prev);
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setIsSidebarOpen(open);
  }, []);

  const toggleChat = useCallback(() => {
    setIsChatOpen((prev) => !prev);
  }, []);

  const setChatOpen = useCallback((open: boolean) => {
    setIsChatOpen(open);
  }, []);

  // Keyboard shortcut: Cmd/Ctrl + B for sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  // Keyboard shortcut: Cmd/Ctrl + J for chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "j") {
        e.preventDefault();
        toggleChat();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleChat]);

  return (
    <UIContext.Provider value={{ isSidebarOpen, isChatOpen }}>
      <UIActionsContext.Provider value={{ toggleSidebar, setSidebarOpen, toggleChat, setChatOpen }}>
        {children}
      </UIActionsContext.Provider>
    </UIContext.Provider>
  );
}

export function useUI() {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}

export function useUIActions() {
  const context = useContext(UIActionsContext);
  if (context === undefined) {
    throw new Error("useUIActions must be used within a UIProvider");
  }
  return context;
}

