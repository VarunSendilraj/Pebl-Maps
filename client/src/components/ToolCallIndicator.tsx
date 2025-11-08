import React from "react";

interface ToolCallIndicatorProps {
    toolName: string;
    status?: 'pending' | 'completed';
}

export default function ToolCallIndicator({ toolName, status = 'pending' }: ToolCallIndicatorProps) {
    // Format tool name for display (convert snake_case to Title Case)
    const displayName = toolName
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

    return (
        <div 
            className="inline-flex items-center gap-2 px-3 py-2 rounded border mb-2"
            style={{
                backgroundColor: '#2d2819',
                borderColor: '#3d2819',
                color: '#ffffff',
            }}
        >
            {/* Tool Icon */}
            <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-4 h-4 flex-shrink-0"
                style={{ color: '#ffffff' }}
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655-5.653a2.548 2.548 0 010-3.586 2.548 2.548 0 013.586 0l5.653 4.655M11.42 15.17l-4.655-5.653a2.548 2.548 0 010-3.586 2.548 2.548 0 013.586 0l5.653 4.655"
                />
            </svg>
            
            {/* Tool Name */}
            <span className="text-sm font-medium">{displayName}</span>
        </div>
    );
}

