"use client";
import React, { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import UserMessage from "./UserMessage";
import AgentMessage from "./AgentMessage";
import TraceAutocomplete from "./TraceAutocomplete";
import { isPrefetched } from "~/app/api/prefetch/searchUtils";

interface Message {
    id: string;
    text: string;
    role: "user" | "assistant";
}

export default function TraceAgent() {
    const [inputValue, setInputValue] = useState<string>("");
    const [conversationHistory, setConversationHistory] = useState<Message[]>([]);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);
    const [autocompleteQuery, setAutocompleteQuery] = useState<string>("");

    // Auto-scroll to bottom when conversation history changes
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [conversationHistory]);

    // Handle click outside to dismiss autocomplete
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showAutocomplete) {
                // If the container doesn't contain the target, dismiss the autocomplete
                if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                    setShowAutocomplete(false);
                }
            }
        };

        if (showAutocomplete) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => { // Cleanup function to remove the event listener when the component unmounts
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [showAutocomplete]);

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
        setShowAutocomplete(false);

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
            await streamResponse(userMessage.text, assistantMessageId, conversationId, setConversationHistory, setConversationId);
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

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        const cursorPosition = e.target.selectionStart || 0;
        setInputValue(value);

        if (!isPrefetched()) {
            return;
        }

        const atIndex = value.lastIndexOf("@");

        // Check if @ was just typed as a new character preceded by whitespace
        if (!showAutocomplete) {
            if (atIndex !== -1 && cursorPosition === atIndex + 1) {
                // Check if @ is preceded by whitespace or is at the start
                const charBeforeAt = atIndex > 0 ? value[atIndex - 1] : " ";
                if (charBeforeAt === " ") {
                    // New @ detected - turn on autocomplete mode
                    setAutocompleteQuery("");

                    setShowAutocomplete(true);
                }
            }
        } else {
            // We're in autocomplete mode - update the query
            if (atIndex !== -1 && cursorPosition > atIndex) {
                const query = value.substring(atIndex + 1, cursorPosition);
                setAutocompleteQuery(query);
            } else {
                // @ was deleted or cursor moved before it
                setShowAutocomplete(false);
            }
        }
    };

    const handleTraceSelect = (trace: { id: string; description: string }) => {
        // Replace the @query with the selected trace
        const atIndex = inputValue.lastIndexOf("@");
        if (atIndex !== -1) {
            const newValue = inputValue.substring(0, atIndex) + `<tid=${trace.id}>`;
            setInputValue(newValue);
        }
        setShowAutocomplete(false);
        inputRef.current?.focus();
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape") {
            setShowAutocomplete(false);
            return;
        }

        // Don't handle Enter if autocomplete is showing (let autocomplete handle it)
        if (showAutocomplete && (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
            return;
        }

        if (e.key === "Enter" && !isProcessing) {
            handleSend();
        }
    };

    return (
        <div ref={containerRef} className="flex flex-col h-full w-full p-6 overflow-hidden relative">
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

            {/* Trace Explorer - positioned above chat input */}
            {showAutocomplete && (
                <TraceAutocomplete
                    query={autocompleteQuery}
                    onSelect={handleTraceSelect}
                    inputRef={inputRef}
                />
            )}

            {/* Chat Input Container */}
            <div className="bg-white rounded-lg p-4 flex items-center gap-3 w-full overflow-hidden border border-gray-300 relative">
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
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
    conversationId: string | null,
    setConversationHistory: Dispatch<SetStateAction<Message[]>>,
    setConversationId: Dispatch<SetStateAction<string | null>>
) {
    const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: query,
            ...(conversationId && { conversationId })
        }),
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
                        // Save conversationId for future requests
                        if (data.conversationId) {
                            setConversationId(data.conversationId);
                        }
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

