import React from "react";
import TraceCard from "../TraceCard";

export function formatMarkdown(text: string): React.ReactNode {
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
                React.createElement('p', { key: elements.length, className: "mb-3" },
                    parseInlineMarkdown(paragraphText)
                )
            );
        }
        currentParagraph = [];
    };

    const processCodeBlock = () => {
        if (codeBlockContent.length > 0) {
            elements.push(
                React.createElement('pre', { key: elements.length, className: "bg-gray-900 p-3 rounded mb-3 overflow-x-auto" },
                    React.createElement('code', { className: "text-sm text-gray-100" }, codeBlockContent.join('\n'))
                )
            );
            codeBlockContent = [];
        }
    };

    // Helper function to parse headers. If a header is detected, we process it and return true. Else, we return false to indicate that no header was detected.
    const parseHeaders = (trimmedLine: string): boolean => {
        if (trimmedLine.startsWith('### ')) {
            processParagraph(); // Push the current paragraph to the elements array and start a new paragraph. This is because we've detected a header.
            elements.push(
                React.createElement('h3', { key: elements.length, className: "text-xl font-bold mt-4 mb-2" },
                    parseInlineMarkdown(trimmedLine.substring(4))
                )
            ); // Push the header to the elements array.
            return true;
        }

        if (trimmedLine.startsWith('## ')) { // Same logic as above, generalized for headers of level 2.
            processParagraph();
            elements.push(
                React.createElement('h2', { key: elements.length, className: "text-2xl font-bold mt-4 mb-2" },
                    parseInlineMarkdown(trimmedLine.substring(3))
                )
            );
            return true;
        }

        if (trimmedLine.startsWith('# ')) { // Same logic as above, generalized for headers of level 1.
            processParagraph();
            elements.push(
                React.createElement('h1', { key: elements.length, className: "text-3xl font-bold mt-4 mb-2" },
                    parseInlineMarkdown(trimmedLine.substring(2))
                )
            );
            return true;
        }

        return false;
    };

    // Iterate through each line of the text (lines are separated by newlines).
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue; // If the line is empty, skip it.
        const trimmedLine = line.trim(); // Trim the line to remove leading and trailing whitespace.

        // Check for code blocks (pattern: "```")
        if (trimmedLine.startsWith('```')) {
            if (inCodeBlock) { // If we're already in a code block, this signifies the end of the code block. 
                processCodeBlock();
                inCodeBlock = false;
            } else {
                processParagraph(); // If we're not in a code block, this signifies the start of a code block.
                inCodeBlock = true;
            }
            continue;
        }

        if (inCodeBlock) {
            codeBlockContent.push(line); // If we're in a code block, add the line to the code block content and continue onto the next line.
            continue;
        }

        // Check for trace format: <trace_id="..." trace_description="...">
        const traceMatch = trimmedLine.match(/^<trace_id="([^"]+)"\s+trace_description="([^"]+)">$/);
        if (traceMatch) {
            console.log('Trace detected:', { traceId: traceMatch[1], traceDescription: traceMatch[2] });
            processParagraph();
            const traceId = traceMatch[1];
            const traceDescription = traceMatch[2];
            let traceCard: React.ReactNode = null;
            try {
                traceCard = React.createElement(TraceCard, {
                    key: elements.length,
                    traceId: traceId ?? '',
                    traceDescription: traceDescription ?? ''
                });
            } catch (err) {
                // If TraceCard's zod validation fails, output an error element to prevent breaking the message rendering
                traceCard = React.createElement('div', {
                    key: elements.length,
                    className: 'bg-red-100 text-red-800 p-2 rounded mb-2'
                }, `Failed to render trace card: ${err instanceof Error ? err.message : String(err)}`);
            }
            if (traceCard) {
                elements.push(traceCard);
            }
            continue;
        }

        // Check for headers
        if (parseHeaders(trimmedLine)) {
            continue;
        }

        // Check for numbered lists (pattern: "1. ", "2. ", etc.)
        const numberedListMatch = trimmedLine.match(/^(\d+)\.\s+(.+)$/); // Regex pattern for numbered lists that take the format "1. ", "2. ", etc.
        if (numberedListMatch) {
            processParagraph();
            // Process any pending list items if switching list types
            if (currentListItems.length > 0 && currentListType && currentListType !== 'ordered') {
                elements.push(
                    React.createElement('ul', { key: elements.length, className: "list-disc ml-6 mb-3" },
                        currentListItems
                    )
                );
                currentListItems = [];
            }
            currentListType = 'ordered';
            const listText = numberedListMatch[2] || '';
            currentListItems.push(
                React.createElement('li', { key: currentListItems.length, className: "mb-1" },
                    parseInlineMarkdown(listText)
                )
            );
            continue;
        }

        // Check for bullet points
        if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
            processParagraph();
            // Process any pending list items if switching list types
            if (currentListItems.length > 0 && currentListType && currentListType !== 'unordered') {
                elements.push(
                    React.createElement('ol', { key: elements.length, className: "list-decimal ml-6 mb-3" },
                        currentListItems
                    )
                );
                currentListItems = [];
            }
            currentListType = 'unordered';
            const bulletText = trimmedLine.substring(2);
            currentListItems.push(
                React.createElement('li', { key: currentListItems.length, className: "mb-1" },
                    parseInlineMarkdown(bulletText)
                )
            );
            continue;
        }

        // Empty line - process paragraph and list
        if (trimmedLine === '') {
            processParagraph();
            if (currentListItems.length > 0 && currentListType) {
                if (currentListType === 'ordered') {
                    elements.push(
                        React.createElement('ol', { key: elements.length, className: "list-decimal ml-6 mb-3" },
                            currentListItems
                        )
                    );
                } else {
                    elements.push(
                        React.createElement('ul', { key: elements.length, className: "list-disc ml-6 mb-3" },
                            currentListItems
                        )
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
                    React.createElement('ol', { key: elements.length, className: "list-decimal ml-6 mb-3" },
                        currentListItems
                    )
                );
            } else {
                elements.push(
                    React.createElement('ul', { key: elements.length, className: "list-disc ml-6 mb-3" },
                        currentListItems
                    )
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
                React.createElement('ol', { key: elements.length, className: "list-decimal ml-6 mb-3" },
                    currentListItems
                )
            );
        } else {
            elements.push(
                React.createElement('ul', { key: elements.length, className: "list-disc ml-6 mb-3" },
                    currentListItems
                )
            );
        }
    }

    return React.createElement('div', {}, elements);
}

export function parseInlineMarkdown(text: string): React.ReactNode {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;

    // Patterns: **bold**, *italic*, `code`
    const patterns = [
        { regex: /\*\*(.+?)\*\*/g, component: (match: string, content: string | undefined) => React.createElement('strong', { key: currentIndex++ }, content || '') },
        { regex: /(?<!\*)\*([^*]+?)\*(?!\*)/g, component: (match: string, content: string | undefined) => React.createElement('em', { key: currentIndex++ }, content || '') },
        { regex: /`(.+?)`/g, component: (match: string, content: string | undefined) => React.createElement('code', { key: currentIndex++, className: "bg-gray-100 px-1 rounded" }, content || '') },
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

    return parts.length > 0 ? React.createElement(React.Fragment, {}, parts) : text;
}
