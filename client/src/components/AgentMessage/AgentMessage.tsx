import React from "react";
import { formatMarkdown } from "./utils";
import ToolCallIndicator from "../ToolCallIndicator";

interface AgentMessageProps {
    text: string;
    toolCalls?: Array<{ toolName: string; status: 'pending' | 'completed' }>;
}

export default function AgentMessage({ text, toolCalls }: AgentMessageProps) {
    return (
        <div className="w-full">
            {/* Tool Call Indicators */}
            {toolCalls && toolCalls.length > 0 && (
                <div className="mb-2">
                    {toolCalls.map((toolCall, index) => (
                        <ToolCallIndicator
                            key={index}
                            toolName={toolCall.toolName}
                            status={toolCall.status}
                        />
                    ))}
                </div>
            )}
            
            {/* Message Text */}
            {text && (
                <div className="text-sm leading-relaxed break-words" style={{ color: '#3d2819' }}>
                    {formatMarkdown(text)}
                </div>
            )}
        </div>
    );
}
