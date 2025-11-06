"use client";
import React, { useState, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";

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
                        <div key={message.id} className="mb-2">
                            {message.role === "user" ? (
                                <div className="flex justify-start">
                                    <div className="max-w-[80%] rounded-lg px-4 py-2 bg-gray-300 text-foreground">
                                        {message.text}
                                    </div>
                                </div>
                            ) : (
                                <div className="mr-4 ml-2 max-w-full break-words text-foreground">
                                    {formatMarkdown(message.text)}
                                </div>
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

function formatMarkdown(text: string): React.ReactNode {
    if (!text) return null;

    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentParagraph: string[] = [];
    let currentListItems: React.ReactNode[] = [];
    let currentListType: 'ordered' | 'unordered' | null = null;
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];

    const processParagraph = () => {
        if (currentParagraph.length === 0) return;
        const paragraphText = currentParagraph.join(' ');
        if (paragraphText.trim()) {
            elements.push(
                <p key={elements.length} className="mb-3">
                    {parseInlineMarkdown(paragraphText)}
                </p>
            );
        }
        currentParagraph = [];
    };

    const processCodeBlock = () => {
        if (codeBlockContent.length > 0) {
            elements.push(
                <pre key={elements.length} className="bg-gray-900 p-3 rounded mb-3 overflow-x-auto">
                    <code className="text-sm text-gray-100">{codeBlockContent.join('\n')}</code>
                </pre>
            );
            codeBlockContent = [];
        }
    };

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const trimmedLine = line.trim();

        // Check for code blocks
        if (trimmedLine.startsWith('```')) {
            if (inCodeBlock) {
                processCodeBlock();
                inCodeBlock = false;
            } else {
                processParagraph();
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent.push(line);
            continue;
        }

        // Check for headers
        if (trimmedLine.startsWith('### ')) {
            processParagraph();
            elements.push(
                <h3 key={elements.length} className="text-xl font-bold mt-4 mb-2">
                    {parseInlineMarkdown(trimmedLine.substring(4))}
                </h3>
            );
            continue;
        }

        if (trimmedLine.startsWith('## ')) {
            processParagraph();
            elements.push(
                <h2 key={elements.length} className="text-2xl font-bold mt-4 mb-2">
                    {parseInlineMarkdown(trimmedLine.substring(3))}
                </h2>
            );
            continue;
        }

        if (trimmedLine.startsWith('# ')) {
            processParagraph();
            elements.push(
                <h1 key={elements.length} className="text-3xl font-bold mt-4 mb-2">
                    {parseInlineMarkdown(trimmedLine.substring(2))}
                </h1>
            );
            continue;
        }

        // Check for numbered lists (pattern: "1. ", "2. ", etc.)
        const numberedListMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/);
        if (numberedListMatch) {
            processParagraph();
            // Process any pending list items if switching list types
            if (currentListItems.length > 0 && currentListType && currentListType !== 'ordered') {
                elements.push(
                    <ul key={elements.length} className="list-disc ml-6 mb-3">
                        {currentListItems}
                    </ul>
                );
                currentListItems = [];
            }
            currentListType = 'ordered';
            const listText = numberedListMatch[2] || '';
            currentListItems.push(
                <li key={currentListItems.length} className="mb-1">
                    {parseInlineMarkdown(listText)}
                </li>
            );
            continue;
        }

        // Check for bullet points
        if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            processParagraph();
            // Process any pending list items if switching list types
            if (currentListItems.length > 0 && currentListType && currentListType !== 'unordered') {
                elements.push(
                    <ol key={elements.length} className="list-decimal ml-6 mb-3">
                        {currentListItems}
                    </ol>
                );
                currentListItems = [];
            }
            currentListType = 'unordered';
            const bulletText = trimmedLine.substring(2);
            currentListItems.push(
                <li key={currentListItems.length} className="mb-1">
                    {parseInlineMarkdown(bulletText)}
                </li>
            );
            continue;
        }

        // Empty line - process paragraph and list
        if (trimmedLine === '') {
            processParagraph();
            if (currentListItems.length > 0 && currentListType) {
                if (currentListType === 'ordered') {
                    elements.push(
                        <ol key={elements.length} className="list-decimal ml-6 mb-3">
                            {currentListItems}
                        </ol>
                    );
                } else {
                    elements.push(
                        <ul key={elements.length} className="list-disc ml-6 mb-3">
                            {currentListItems}
                        </ul>
                    );
                }
                currentListItems = [];
                currentListType = null;
            }
            continue;
        }

        // Regular line - process any pending list items, then add to paragraph
        if (currentListItems.length > 0 && currentListType) {
            if (currentListType === 'ordered') {
                elements.push(
                    <ol key={elements.length} className="list-decimal ml-6 mb-3">
                        {currentListItems}
                    </ol>
                );
            } else {
                elements.push(
                    <ul key={elements.length} className="list-disc ml-6 mb-3">
                        {currentListItems}
                    </ul>
                );
            }
            currentListItems = [];
            currentListType = null;
        }
        currentParagraph.push(line);
    }

    processParagraph();
    processCodeBlock();

    // Process any remaining list items
    if (currentListItems.length > 0 && currentListType) {
        if (currentListType === 'ordered') {
            elements.push(
                <ol key={elements.length} className="list-decimal ml-6 mb-3">
                    {currentListItems}
                </ol>
            );
        } else {
            elements.push(
                <ul key={elements.length} className="list-disc ml-6 mb-3">
                    {currentListItems}
                </ul>
            );
        }
    }

    return <div>{elements}</div>;
}

function parseInlineMarkdown(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    // Patterns: **bold**, *italic*, `code`
    const patterns = [
        { regex: /\*\*(.+?)\*\*/g, component: (match: string, content: string | undefined) => <strong key={currentIndex++}>{content || ''}</strong> },
        { regex: /(?<!\*)\*([^*]+?)\*(?!\*)/g, component: (match: string, content: string | undefined) => <em key={currentIndex++}>{content || ''}</em> },
        { regex: /`(.+?)`/g, component: (match: string, content: string | undefined) => <code key={currentIndex++} className="bg-gray-100 px-1 rounded">{content || ''}</code> },
    ];

    let lastIndex = 0;
    const matches: Array<{ index: number; length: number; component: React.ReactNode }> = [];

    // Find all matches
    patterns.forEach(({ regex, component }) => {
        let match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null) {
            matches.push({
                index: match.index,
                length: match[0].length,
                component: component(match[0], match[1]),
            });
        }
    });

    // Sort matches by index
    matches.sort((a, b) => a.index - b.index);

    // Build result
    matches.forEach((match) => {
        if (match.index > lastIndex) {
            parts.push(text.substring(lastIndex, match.index));
        }
        parts.push(match.component);
        lastIndex = match.index + match.length;
    });

    if (lastIndex < text.length) {
        parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
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

