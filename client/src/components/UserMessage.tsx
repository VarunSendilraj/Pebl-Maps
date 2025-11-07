import React from "react";

interface UserMessageProps {
    text: string;
}

export default function UserMessage({ text }: UserMessageProps) {
    return (
        <div className="flex justify-start">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-300 text-foreground">
                {text}
            </div>
        </div>
    );
}
