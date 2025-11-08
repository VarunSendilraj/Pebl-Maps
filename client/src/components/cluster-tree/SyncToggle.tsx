"use client";

import { useNavigationState, useNavigationActions } from "~/contexts/NavigationContext";
import type { ClusterNode } from "~/lib/bubbles/types";

interface SyncToggleProps {
  onResetRequest?: () => void;
  rootData?: ClusterNode;
}

export default function SyncToggle({ onResetRequest, rootData }: SyncToggleProps) {
  const { isSyncModeEnabled } = useNavigationState();
  const { setSyncMode, navigateToRoot, selectNode } = useNavigationActions();

  const handleToggle = () => {
    setSyncMode(!isSyncModeEnabled);
  };

  const handleHomeClick = () => {
    // Reset file explorer (collapse all)
    onResetRequest?.();
    
    // Reset map to top level root view
    if (rootData) {
      navigateToRoot(rootData, []);
      selectNode(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center px-1.5 py-2 border-t border-gray-200 bg-gradient-to-b from-transparent to-gray-50/50 w-full min-w-0 flex-shrink-0">
      {/* Main toggle row - split in half */}
      <div className="flex items-center w-full min-w-0">
        {/* Left half - Home button centered with text below */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <button
            type="button"
            onClick={handleHomeClick}
            aria-label="Reset to home view - collapse all and return to root"
            title="Reset to home view - collapse all and return to root"
            className="shrink-0 p-1 rounded hover:bg-gray-200 transition-colors"
          >
            <svg
              className="w-3.5 h-3.5 text-[#8a817c]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </button>
          {/* Home text - under the icon */}
          <p 
            className="text-[9px] text-gray-400 mt-0.5 leading-tight px-0.5 max-w-full truncate"
            title="Reset to home view"
            aria-hidden="true"
          >
            Home
          </p>
        </div>

        {/* Right half - Sync toggle centered with text below */}
        <div className="flex-1 flex flex-col items-center justify-center">
          <div className="flex items-center justify-center gap-1">
            {/* Icon - bigger and always visible */}
            <div className="shrink-0">
              {isSyncModeEnabled ? (
                <svg
                  className="w-4 h-4 text-[#8a817c] flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
              ) : (
                <svg
                  className="w-4 h-4 text-gray-400 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="8" r="2.5" strokeWidth={1.5} />
                  <circle cx="16" cy="16" r="2.5" strokeWidth={1.5} />
                </svg>
              )}
            </div>

            {/* Toggle Switch - compact, always visible and centered */}
            <button
              type="button"
              role="switch"
              aria-checked={isSyncModeEnabled}
              aria-label={`Sync navigation: ${isSyncModeEnabled ? "enabled" : "disabled"}. Click to ${isSyncModeEnabled ? "disable" : "enable"}.`}
              onClick={handleToggle}
              title={isSyncModeEnabled ? "Sync ON - Bubble map and tree move together" : "Sync OFF - Navigate independently"}
              className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#8a817c] focus:ring-offset-1 ${
                isSyncModeEnabled
                  ? "bg-[#8a817c]"
                  : "bg-gray-300"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-3 w-3 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  isSyncModeEnabled ? "translate-x-3" : "translate-x-0"
                }`}
              />
            </button>
          </div>

          {/* Compact status text - under the toggle */}
          <p 
            className="text-[9px] text-gray-400 mt-0.5 leading-tight px-0.5 max-w-full truncate"
            title={isSyncModeEnabled ? "Bubble map and tree move together" : "Navigate independently"}
            aria-hidden="true"
          >
            {isSyncModeEnabled ? "Synced" : "Independent"}
          </p>
        </div>
      </div>
    </div>
  );
}

