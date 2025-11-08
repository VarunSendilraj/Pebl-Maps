import React from "react";
import { formatMarkdown } from "./utils";

interface AgentMessageProps {
    text: string;
}

export default function AgentMessage({ text }: AgentMessageProps) {
    return (
        <div className="w-full text-sm leading-relaxed break-words" style={{ color: '#3d2819' }}>
            {formatMarkdown(text)}
        </div>
    );
}
