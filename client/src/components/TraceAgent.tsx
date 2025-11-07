"use client";
import React, { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import UserMessage from "./UserMessage";
import AgentMessage from "./AgentMessage";

interface Message {
    id: string;
    text: string;
    role: "user" | "assistant";
}

export default function TraceAgent() {
    const [inputValue, setInputValue] = useState<string>("");
    const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom when conversation history changes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversationHistory]);

    const handleSend = async () => {
        if (!inputValue.trim() || isProcessing) return;

        const userMessage: Message = {
            id: Date.now().toString(),
            text: inputValue.trim(),
            role: "user",
        };

        // Add user message to conversation history
        setConversationHistory((prev) => [...prev, userMessage]);
        setInputValue("");
        setIsProcessing(true);

        // Create assistant message placeholder
        const assistantMessageId = (Date.now() + 1).toString();
        const assistantMessage: Message = {
            id: assistantMessageId,
            text: "",
            role: "assistant",
        };

        // Add empty assistant message to conversation history
        setConversationHistory((prev) => [...prev, assistantMessage]);

        try {
            await streamResponse(userMessage.text, assistantMessageId, setConversationHistory);
        } catch (error) {
            console.error("Failed to send message:", error);
            // Update the assistant message with error
            setConversationHistory((prev) =>
                prev.map((msg) =>
                    msg.id === assistantMessageId
                        ? { ...msg, text: "Failed to get response. Please try again." }
                        : msg
                )
            );
        } finally {
            setIsProcessing(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !isProcessing) {
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-full w-full p-6 overflow-hidden">
            {/* Title and Subtitle Section */}
            {conversationHistory.length === 0 && (
                <div className="flex flex-col mb-8">
                    <h1 className="text-4xl font-bold text-foreground mb-2">
                        Hey, Varoon
                    </h1>
                    <p className="text-lg text-foreground">
                        How can I help you today?
                    </p>
                </div>
            )}

            {/* Conversation History */}
            <div className="flex-1 overflow-y-auto mb-4 pt-4 min-h-0">
                <div className="flex flex-col gap-3">
                    {conversationHistory.map((message) => (
                        <div key={message.id} className="mb-3">
                            {message.role === "user" ? (
                                <UserMessage text={message.text} />
                            ) : (
                                <AgentMessage text={message.text} />
                            )}
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Chat Input Container */}
            <div className="bg-white rounded-lg p-4 flex items-center gap-3 w-full overflow-hidden border border-gray-300">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyPress}
                    placeholder="How can I help you today?"
                    disabled={isProcessing}
                    className="flex-1 min-w-0 bg-transparent text-foreground placeholder-gray-500 outline-none disabled:opacity-50"
                />
                <button
                    onClick={handleSend}
                    disabled={!inputValue.trim() || isProcessing}
                    className="bg-primary text-primary-foreground p-3 rounded-lg hover:opacity-90 transition-opacity flex items-center justify-center w-[48px] flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={isProcessing ? "Processing" : "Send message"}
                >
                    {isProcessing ? (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-5 h-5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M15.75 5.25v13.5m-7.5-13.5v13.5"
                            />
                        </svg>
                    ) : (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-5 h-5"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18m0-18v18"
                            />
                        </svg>
                    )}
                </button>
            </div>
        </div>
    );
}

async function streamResponse(
    query: string,
    assistantMessageId: string,
    setConversationHistory: Dispatch<SetStateAction<Message[]>>
) {
    const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ query: query }),
    });

    if (!response.ok) {
        throw new Error(`Failed to get response from API: ${response.statusText}`);
    }

    if (!response.body) {
        throw new Error("Response body is null");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
            if (line.startsWith("data: ")) {
                try {
                    const data = JSON.parse(line.slice(6));

                    if (data.error) {
                        throw new Error(data.error);
                    }

                    if (data.done) {
                        return;
                    }

                    if (data.chunk) {
                        // Update the assistant message incrementally
                        setConversationHistory((prev) =>
                            prev.map((msg) =>
                                msg.id === assistantMessageId
                                    ? { ...msg, text: msg.text + data.chunk }
                                    : msg
                            )
                        );
                    }
                } catch (e) {
                    console.error("Error parsing stream data:", e);
                }
            }
        }
    }
}

