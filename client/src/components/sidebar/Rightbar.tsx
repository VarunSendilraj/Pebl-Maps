"use client";

import { useUI } from "~/contexts/UIContext";
import { type ReactNode } from "react";

interface RightbarProps {
  children: ReactNode;
}

export default function Rightbar({ children }: RightbarProps) {
  const { isChatOpen } = useUI();

  return (
    <aside
      className={`
        flex flex-col overflow-hidden transition-[width] duration-200 ease-in-out
        ${isChatOpen ? "w-[340px]" : "w-0"}
      `}
      aria-expanded={isChatOpen}
      aria-label="Chat sidebar"
    >
      {isChatOpen && (
        <div className="flex-1 overflow-hidden min-w-0 h-full">
          {children}
        </div>
      )}
    </aside>
  );
}

