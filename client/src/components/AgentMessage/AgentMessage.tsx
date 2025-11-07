import React from "react";
import { formatMarkdown } from "./utils";

interface AgentMessageProps {
    text: string;
}

export default function AgentMessage({ text }: AgentMessageProps) {
    return (
        <div className="mr-4 ml-2 max-w-full break-words text-foreground">
            {formatMarkdown(text)}
        </div>
    );
}
