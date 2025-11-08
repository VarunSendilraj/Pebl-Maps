"use client";

import { useTabs } from "~/contexts/TabsContext";
import TabIcon from "./TabIcon";
import { getBaseColorForNode } from "~/lib/bubbles/colors";
import { useUI, useUIActions } from "~/contexts/UIContext";

export default function CanvasTabs() {
  const { tabs, activeTabId, activateTab, closeTab } = useTabs();
  const { isSidebarOpen, isChatOpen } = useUI();
  const { toggleSidebar, toggleChat } = useUIActions();

  // Get cluster color for trace tabs
  const getClusterColor = (tab: typeof tabs[0]): string | undefined => {
    if (tab.kind === 'trace' && tab.l2_cluster_id !== undefined) {
      const color = getBaseColorForNode({
        type: 'l0',
        l2_cluster_id: tab.l2_cluster_id,
        id: '',
      });
      return color;
    }
    return undefined;
  };

  return (
    <div 
      className="flex border-b transition-colors"
      style={{ 
        backgroundColor: '#e5e0d8',
        borderColor: '#d8d3cb'
      }}
    >
      {/* Hamburger toggle button */}
      <button
        onClick={toggleSidebar}
        className="flex items-center justify-center px-3 py-2.5 border-r transition-colors hover:bg-opacity-50"
        style={{
          borderRightColor: '#d8d3cb',
          backgroundColor: isSidebarOpen ? 'rgba(201, 196, 188, 0.3)' : 'transparent',
        }}
        aria-label="Toggle Explorer"
        aria-expanded={isSidebarOpen}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(201, 196, 188, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isSidebarOpen ? 'rgba(201, 196, 188, 0.3)' : 'transparent';
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-5 h-5"
          style={{ color: '#8a817c' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
          />
        </svg>
      </button>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const isMapTab = tab.id === 'map';
        const clusterColor = getClusterColor(tab);
        
        return (
          <div
            key={tab.id}
            className={`
              flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all cursor-pointer relative group flex-shrink min-w-0
              ${isActive 
                ? '' 
                : 'hover:bg-opacity-50'
              }
            `}
            style={{
              backgroundColor: isActive ? '#c9c4bc' : 'transparent',
              borderBottomColor: isActive ? '#8b4a3a' : 'transparent',
              borderBottomWidth: isActive ? '2px' : '0px',
              minWidth: '100px',
              flex: '1 1 0',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'rgba(201, 196, 188, 0.3)';
                // Show close button on hover for inactive tabs
                const closeBtn = e.currentTarget.querySelector('button[aria-label*="Close"]') as HTMLElement;
                if (closeBtn) {
                  closeBtn.style.opacity = '1';
                }
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
                // Hide close button when leaving inactive tab
                const closeBtn = e.currentTarget.querySelector('button[aria-label*="Close"]') as HTMLElement;
                if (closeBtn) {
                  closeBtn.style.opacity = '0';
                }
              }
            }}
            onClick={() => activateTab(tab.id)}
          >
            {/* Icon */}
            <TabIcon 
              kind={tab.kind} 
              clusterColor={clusterColor}
            />
            
            {/* Label */}
            <span 
              className="text-sm font-medium truncate min-w-0 flex-1"
              style={{
                color: isActive ? '#3d2819' : '#8a817c',
              }}
            >
              {tab.label}
            </span>
            
            {/* Close button */}
            {!isMapTab && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className={`
                  ml-1 rounded transition-all flex items-center justify-center
                  ${isActive ? 'opacity-100' : 'opacity-0'}
                `}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '1';
                  e.currentTarget.style.backgroundColor = 'rgba(139, 74, 58, 0.1)';
                  e.currentTarget.style.color = '#8b4a3a';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.opacity = '0';
                  }
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = isActive ? '#6b6560' : '#8a817c';
                }}
                style={{
                  color: isActive ? '#6b6560' : '#8a817c',
                  width: '16px',
                  height: '16px',
                }}
                aria-label={`Close ${tab.label}`}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2.5}
                  stroke="currentColor"
                  className="w-3 h-3"
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
      {/* Chat toggle button - on the right side */}
      <button
        onClick={toggleChat}
        className="flex items-center justify-center px-3 py-2.5 border-l transition-colors hover:bg-opacity-50 ml-auto"
        style={{
          borderLeftColor: '#d8d3cb',
          backgroundColor: isChatOpen ? 'rgba(201, 196, 188, 0.3)' : 'transparent',
        }}
        aria-label="Toggle Chat"
        aria-expanded={isChatOpen}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = 'rgba(201, 196, 188, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = isChatOpen ? 'rgba(201, 196, 188, 0.3)' : 'transparent';
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
          className="w-5 h-5"
          style={{ color: '#8a817c' }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
          />
        </svg>
      </button>
    </div>
  );
}

