"use client";

import { useTabs } from "~/contexts/TabsContext";

export default function CanvasTabs() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabs();

  return (
    <div className="flex border-b border-gray-300 bg-white">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isMapTab = tab.id === 'map';
        
        return (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 px-4 py-2 border-b-2 transition-colors cursor-pointer
              ${isActive 
                ? 'border-blue-500 bg-blue-50 text-blue-700' 
                : 'border-transparent hover:bg-gray-50 text-gray-600'
              }
            `}
            onClick={() => activateTab(tab.id)}
          >
            <span className="text-sm font-medium">{tab.label}</span>
            {!isMapTab && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="ml-1 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label={`Close ${tab.label}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-4 h-4"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

