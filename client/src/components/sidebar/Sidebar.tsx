"use client";

import { useUI } from "~/contexts/UIContext";
import { type ReactNode } from "react";

interface SidebarProps {
  children: ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  const { isSidebarOpen } = useUI();

  return (
    <aside
      className={`
        flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out
        ${isSidebarOpen ? "w-[280px]" : "w-0"}
      `}
      aria-expanded={isSidebarOpen}
      aria-label="Explorer sidebar"
    >
      {isSidebarOpen && (
        <div className="flex-1 overflow-hidden min-w-0 h-full">
          {children}
        </div>
      )}
    </aside>
  );
}

