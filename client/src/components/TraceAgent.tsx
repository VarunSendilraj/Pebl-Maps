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
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [showAutocomplete, setShowAutocomplete] = useState<boolean>(false);
    const [autocompleteQuery, setAutocompleteQuery] = useState<string>("");
    const [mode, setMode] = useState<"ask" | "agent">("ask");
    const [showModeDropdown, setShowModeDropdown] = useState<boolean>(false);
    const modeDropdownRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    // Handle click outside to dismiss mode dropdown
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (showModeDropdown) {
                const target = e.target as Node;
                if (
                    modeDropdownRef.current &&
                    !modeDropdownRef.current.contains(target) &&
                    dropdownRef.current &&
                    !dropdownRef.current.contains(target)
                ) {
                    setShowModeDropdown(false);
                }
            }
        };

        if (showModeDropdown) {
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }
    }, [showModeDropdown]);

    // Position dropdown overlay
    useEffect(() => {
        if (showModeDropdown && modeDropdownRef.current && dropdownRef.current) {
            const buttonRect = modeDropdownRef.current.getBoundingClientRect();
            const dropdownHeight = 80; // Approximate height of dropdown (2 items)
            // Position above the button
            dropdownRef.current.style.top = `${buttonRect.top - dropdownHeight - 4}px`;
            dropdownRef.current.style.left = `${buttonRect.left}px`;
        }
    }, [showModeDropdown]);

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
        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

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

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        const cursorPosition = e.target.selectionStart || 0;
        setInputValue(value);

        // Auto-resize textarea
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 200)}px`;
        }

        if (!isPrefetched()) {
            return;
        }

        const atIndex = value.lastIndexOf("@");

        // Check if @ was just typed as a new character preceded by whitespace
        if (!showAutocomplete) {
            if (atIndex !== -1 && cursorPosition === atIndex + 1) {
                // Check if @ is preceded by whitespace or is at the start
                const charBeforeAt = atIndex > 0 ? value[atIndex - 1] : " ";
                if (charBeforeAt === " " || charBeforeAt === "\n") {
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

    const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Escape") {
            setShowAutocomplete(false);
            return;
        }

        // Don't handle Enter if autocomplete is showing (let autocomplete handle it)
        if (showAutocomplete && (e.key === "Enter" || e.key === "ArrowDown" || e.key === "ArrowUp")) {
            return;
        }

        // Shift+Enter for new line, Enter to send
        if (e.key === "Enter" && !e.shiftKey && !isProcessing) {
            e.preventDefault();
            handleSend();
        }
    };

    const presetPrompts = [
        {
            text: "Analyze recent trace patterns",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                </svg>
            ),
        },
        {
            text: "Top 5 use case categories this week",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </svg>
            ),
        },
        {
            text: "Summarize cluster performance",
            icon: (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
            ),
        },
    ];

    const presetBackgrounds = [
        "rgba(201, 196, 188, 0.3)",
        "rgba(201, 196, 188, 0.2)",
        "rgba(201, 196, 188, 0.15)",
    ];

    const handlePresetClick = async (promptText: string) => {
        if (isProcessing) return;

        // Set the input value and send immediately
        setInputValue(promptText);

        // Create user message
        const userMessage: Message = {
            id: Date.now().toString(),
            text: promptText,
            role: "user",
        };

        // Add user message to conversation history
        setConversationHistory((prev) => [...prev, userMessage]);
        setInputValue("");
        setIsProcessing(true);
        setShowAutocomplete(false);
        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }

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
            await streamResponse(promptText, assistantMessageId, conversationId, setConversationHistory, setConversationId);
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

    const handleCloseChat = () => {
        setConversationHistory([]);
        setInputValue("");
        setConversationId(null);
        // Reset textarea height
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
        }
    };

    return (
        <div
            ref={containerRef}
            className="flex flex-col h-full w-full overflow-hidden relative"
            style={{ backgroundColor: '#e5e0d8' }}
        >
            {/* Chat Tabs */}
            <div
                className="flex border-b"
                style={{
                    backgroundColor: '#e5e0d8',
                    borderColor: '#d8d3cb'
                }}
            >
                <div
                    className="flex items-center gap-2 px-4 py-2.5 border-b-2 transition-all relative group"
                    style={{
                        backgroundColor: '#c9c4bc',
                        borderBottomColor: '#8b4a3a',
                        borderBottomWidth: '2px',
                    }}
                >
                    {/* Chat icon */}
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                        className="w-4 h-4"
                        style={{ color: '#3d2819' }}
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
                        />
                    </svg>

                    {/* Label */}
                    <span
                        className="text-sm font-medium"
                        style={{
                            color: '#3d2819',
                        }}
                    >
                        Chat
                    </span>

                    {/* Close button - disabled/undeletable */}
                    <button
                        disabled
                        className="ml-1 rounded transition-all flex items-center justify-center opacity-50 cursor-not-allowed"
                        style={{
                            color: '#8a817c',
                            width: '16px',
                            height: '16px',
                        }}
                        aria-label="Close Chat (disabled)"
                        title="Chat tab cannot be closed"
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
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col min-h-0">
                {/* Preset Prompts - shown when no conversation */}
                {conversationHistory.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center py-8">
                        <div className="flex flex-col gap-6 w-full max-w-md">
                            {/* Preset Prompts */}
                            <div className="flex flex-col gap-3">
                                {presetPrompts.map((prompt, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handlePresetClick(prompt.text)}
                                        disabled={isProcessing}
                                        className={`text-left p-4 rounded border transition-all flex items-center gap-3 ${isProcessing ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-90'
                                            }`}
                                        style={{
                                            backgroundColor: presetBackgrounds[index],
                                            borderColor: '#d8d3cb',
                                            color: '#3d2819',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!isProcessing) {
                                                e.currentTarget.style.backgroundColor = 'rgba(201, 196, 188, 0.4)';
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!isProcessing) {
                                                e.currentTarget.style.backgroundColor = presetBackgrounds[index] || 'rgba(201, 196, 188, 0.15)';
                                            }
                                        }}
                                    >
                                        <span className="flex-shrink-0" style={{ color: '#8a817c' }}>
                                            {prompt.icon}
                                        </span>
                                        <span className="text-sm font-medium">{prompt.text}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Past Conversations */}
                            <div className="flex flex-col gap-2">
                                <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: '#8a817c' }}>
                                    Recent
                                </h3>
                                <div className="flex flex-col gap-1">
                                    {[
                                        {
                                            title: "Trace analysis for authentication flows",
                                            time: "2 hours ago",
                                            icon: (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                            ),
                                        },
                                        {
                                            title: "Cluster performance summary",
                                            time: "Yesterday",
                                            icon: (
                                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                                                </svg>
                                            ),
                                        },
                                    ].map((conversation, index) => (
                                        <button
                                            key={index}
                                            className="text-left p-3 rounded border transition-all flex items-center gap-3 group cursor-pointer"
                                            style={{
                                                backgroundColor: 'transparent',
                                                borderColor: 'transparent',
                                                color: '#3d2819',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.backgroundColor = 'rgba(201, 196, 188, 0.2)';
                                                e.currentTarget.style.borderColor = '#d8d3cb';
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                                e.currentTarget.style.borderColor = 'transparent';
                                            }}
                                        >
                                            <span className="flex-shrink-0" style={{ color: '#8a817c' }}>
                                                {conversation.icon}
                                            </span>
                                            <div className="flex-1 min-w-0 flex items-center justify-between gap-3">
                                                <span className="text-sm font-medium truncate">{conversation.title}</span>
                                                <span className="text-xs flex-shrink-0" style={{ color: '#8a817c' }}>
                                                    {conversation.time}
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Conversation History */}
                {conversationHistory.length > 0 && (
                    <div className="flex-1 overflow-y-auto mb-4 min-h-0">
                        <div className="flex flex-col gap-3">
                            {conversationHistory.map((message) => (
                                <div key={message.id}>
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
                )}
            </div>

            {/* Chat Input Container - fixed at bottom */}
            <div className="p-6 pt-0 flex-shrink-0">
                {/* Trace Explorer - positioned above chat input */}
                {showAutocomplete && (
                    <TraceAutocomplete
                        query={autocompleteQuery}
                        onSelect={handleTraceSelect}
                        inputRef={inputRef}
                    />
                )}

                {/* Chat Input Container */}
                <div
                    className="rounded-lg border flex flex-col w-full"
                    style={{
                        backgroundColor: '#ffffff',
                        borderColor: '#d8d3cb',
                    }}
                >
                    {/* Input field row */}
                    <div className="flex items-start p-3">
                        <textarea
                            ref={inputRef}
                            value={inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyPress}
                            placeholder="Plan, @ for context, / for commands"
                            disabled={isProcessing}
                            rows={1}
                            className="flex-1 min-w-0 bg-transparent text-foreground placeholder-gray-500 outline-none disabled:opacity-50 text-sm resize-none overflow-hidden"
                            style={{
                                minHeight: '20px',
                                maxHeight: '200px',
                                lineHeight: '1.5',
                            }}
                        />
                    </div>

                    {/* Controls row - below input */}
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-t relative" style={{ borderTopColor: '#d8d3cb' }}>
                        {/* Left side: Ask mode dropdown */}
                        <div className="flex items-center relative" ref={modeDropdownRef}>
                            <button
                                onClick={() => setShowModeDropdown(!showModeDropdown)}
                                className="px-2.5 py-1 rounded-full border flex items-center gap-1.5 transition-all hover:bg-gray-50"
                                style={{
                                    backgroundColor: '#f0f0eb',
                                    borderColor: '#d8d3cb',
                                    color: '#3d2819',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#e5e0d8';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f0f0eb';
                                }}
                            >
                                {mode === "ask" ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                                    </svg>
                                )}
                                <span className="text-xs font-medium">{mode === "ask" ? "Ask" : "Agent mode"}</span>
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={2}
                                    stroke="currentColor"
                                    className={`w-2.5 h-2.5 transition-transform ${showModeDropdown ? 'rotate-180' : ''}`}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                                </svg>
                            </button>

                            {/* Dropdown menu - overlay */}
                            {showModeDropdown && (
                                <div
                                    ref={dropdownRef}
                                    className="fixed rounded-lg border shadow-lg overflow-hidden"
                                    style={{
                                        backgroundColor: '#ffffff',
                                        borderColor: '#d8d3cb',
                                        zIndex: 9999,
                                        minWidth: '140px',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                    }}
                                >
                                    <button
                                        onClick={() => {
                                            setMode("ask");
                                            setShowModeDropdown(false);
                                        }}
                                        className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${mode === "ask" ? "bg-gray-50" : "hover:bg-gray-50"
                                            }`}
                                        style={{
                                            color: mode === "ask" ? '#3d2819' : '#8a817c',
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                                        </svg>
                                        <span className="text-xs font-medium">Ask</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            setMode("agent");
                                            setShowModeDropdown(false);
                                        }}
                                        className={`w-full px-3 py-2 text-left flex items-center gap-2 transition-colors ${mode === "agent" ? "bg-gray-50" : "hover:bg-gray-50"
                                            }`}
                                        style={{
                                            color: mode === "agent" ? '#3d2819' : '#8a817c',
                                        }}
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.035-.259a3.375 3.375 0 002.456-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                                        </svg>
                                        <span className="text-xs font-medium">Agent mode</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Right side: Icons */}
                        <div className="flex items-center gap-1.5">
                            {/* @ icon */}
                            <button
                                onClick={() => {
                                    setInputValue((prev) => prev + '@');
                                    inputRef.current?.focus();
                                }}
                                className="p-1.5 rounded transition-all hover:bg-gray-100 flex items-center justify-center"
                                style={{ color: '#8a817c' }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.backgroundColor = '#f0f0eb';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.backgroundColor = 'transparent';
                                }}
                                aria-label="Insert @"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" />
                                </svg>
                            </button>

                            {/* Upload/Send icon - circular, bottom right */}
                            <button
                                onClick={handleSend}
                                disabled={!inputValue.trim() || isProcessing}
                                className="w-7 h-7 rounded-full transition-all hover:opacity-90 flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    backgroundColor: '#8b4a3a',
                                    color: '#ffffff',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isProcessing && inputValue.trim()) {
                                        e.currentTarget.style.opacity = '0.9';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.opacity = '1';
                                }}
                                aria-label={isProcessing ? "Processing" : "Send message"}
                            >
                                {isProcessing ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-3.5 h-3.5">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18m0-18v18" />
                                    </svg>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
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

