"use client";
import React, { useEffect, useState, useRef } from "react";
import { searchTraces } from "../app/api/prefetch/searchUtils";

interface TraceAutocompleteProps {
    query: string;
    onSelect: (trace: { id: string; description: string }) => void;
    inputRef: React.RefObject<HTMLInputElement | null>;
}

export default function TraceAutocomplete({ query, onSelect, inputRef }: TraceAutocompleteProps) {
    const [results, setResults] = useState<Array<{ id: string; description: string }>>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [width, setWidth] = useState(0);
    const selectedItemRef = useRef<HTMLDivElement | null>(null);

    // Match the width of the input element
    useEffect(() => {
        if (inputRef.current) {
            const updateWidth = () => {
                setWidth(inputRef.current!.offsetWidth);
            };
            updateWidth();

            const resizeObserver = new ResizeObserver(updateWidth); // Observer to watch for changes in the input element's width
            resizeObserver.observe(inputRef.current);

            return () => resizeObserver.disconnect();
        }
    }, [inputRef]);

    useEffect(() => {
        if (query.trim()) {
            const searchResults = searchTraces(query);
            setResults(searchResults.map(r => ({ id: r.id, description: r.description })));
            setSelectedIndex(0);
        } else {
            setResults([]);
        }
    }, [query]);

    // Scroll selected item into view when selectedIndex changes
    useEffect(() => {
        if (selectedItemRef.current) {
            selectedItemRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [selectedIndex]);

    // Handles keyboard navigation between autocomplete results & selection of a trace.
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (results.length === 0) return;

            if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % results.length);
            } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + results.length) % results.length);
            } else if (e.key === "Enter") {
                e.preventDefault();
                if (results[selectedIndex]) {
                    onSelect(results[selectedIndex]);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [results, selectedIndex, onSelect]);

    // If no results, don't render anything.
    if (results.length === 0) {
        return null;
    }

    return (
        <div
            className="bg-white shadow-lg border border-gray-200 overflow-y-auto"
            style={{
                width: width > 0 ? `${width}px` : "100%",
                borderRadius: "1rem 1rem 0 0",
            }}
        >
            <div className={`max-h-[300px] ${width > 0 ? `w-[${width}px]` : "w-full"} overflow-y-auto`}>
                {results.map((result, index) => (
                    <div
                        key={result.id}
                        ref={index === selectedIndex ? selectedItemRef : null}
                        className={`px-4 py-3 cursor-pointer transition-colors ${index === selectedIndex
                            ? "bg-primary/10 border-l-4 border-primary"
                            : "hover:bg-gray-50 border-l-4 border-transparent"
                            }`}
                        onClick={() => onSelect(result)}
                        onMouseEnter={() => setSelectedIndex(index)}
                    >
                        <div className="text-sm font-medium text-gray-900 truncate">
                            {result.description}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            ID: {result.id}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
