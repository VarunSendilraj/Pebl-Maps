"use client";

import { useNavigationState, useNavigationActions } from "~/contexts/NavigationContext";

export default function SyncToggle() {
  const { isSyncModeEnabled } = useNavigationState();
  const { setSyncMode } = useNavigationActions();

  const handleToggle = () => {
    setSyncMode(!isSyncModeEnabled);
  };

  return (
    <div className="flex flex-col items-center justify-center px-1.5 py-2 border-t border-gray-200 bg-gradient-to-b from-transparent to-gray-50/50 w-full min-w-0 flex-shrink-0">
      {/* Main toggle row - always fits */}
      <div className="flex items-center justify-center gap-1.5 w-full min-w-0">
        {/* Icon - smaller and always visible */}
        <div className="shrink-0">
          {isSyncModeEnabled ? (
            <svg
              className="w-3 h-3 text-[#8a817c] flex-shrink-0"
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
              className="w-3 h-3 text-gray-400 flex-shrink-0"
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

      {/* Compact status text - wraps if needed, very small */}
      <p 
        className="text-[9px] text-gray-400 mt-0.5 text-center leading-tight px-0.5 max-w-full truncate"
        title={isSyncModeEnabled ? "Bubble map and tree move together" : "Navigate independently"}
        aria-hidden="true"
      >
        {isSyncModeEnabled ? "Synced" : "Independent"}
      </p>
    </div>
  );
}

