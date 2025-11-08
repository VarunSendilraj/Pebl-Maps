"use client";

import { type ReactNode } from "react";
import { useUI } from "~/contexts/UIContext";

interface WorkspaceProps {
  sidebar: ReactNode;
  editor: ReactNode;
  rightbar?: ReactNode;
}

export default function Workspace({ sidebar, editor, rightbar }: WorkspaceProps) {
  const { isSidebarOpen, isChatOpen } = useUI();

  return (
    <div className="flex flex-1 flex-row items-stretch m-4 rounded-lg overflow-hidden bg-white shadow-md" style={{ backgroundColor: '#f0f0eb' }}>
      {sidebar}
      {/* Vertical divider - only show when sidebar is open */}
      {isSidebarOpen && (
        <div 
          className="w-px shrink-0 transition-opacity duration-200" 
          style={{ backgroundColor: '#d8d3cb' }}
        />
      )}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {editor}
      </div>
      {/* Vertical divider - only show when chat is open */}
      {isChatOpen && rightbar && (
        <div 
          className="w-px shrink-0 transition-opacity duration-200" 
          style={{ backgroundColor: '#d8d3cb' }}
        />
      )}
      {rightbar}
    </div>
  );
}

