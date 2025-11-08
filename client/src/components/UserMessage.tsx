import React from "react";

interface UserMessageProps {
    text: string;
}

export default function UserMessage({ text }: UserMessageProps) {
    return (
        <div 
            className="rounded-lg border w-full overflow-hidden"
            style={{
                backgroundColor: '#f5f3f0',
                borderColor: '#d8d3cb',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
        >
            <div 
                className="px-4 py-3"
                style={{
                    color: '#3d2819',
                }}
            >
                <span className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                    {text}
                </span>
            </div>
        </div>
    );
}
