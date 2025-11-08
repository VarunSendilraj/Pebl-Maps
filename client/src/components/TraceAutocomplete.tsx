"use client";
import React, { useEffect, useState, useRef } from "react";
import { searchAll } from "../app/api/prefetch/searchUtils";
import MiniOrb from "./MiniOrb";

interface TraceAutocompleteProps {
    query: string;
    onSelect: (trace: { id: string; description: string }) => void;
    inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

type ResultType = "trace" | "l0Cluster" | "l1Cluster" | "l2Cluster";

interface AutocompleteResult {
    id: string;
    displayName: string;
    type: ResultType;
    l2ClusterId?: number;
}

export default function TraceAutocomplete({ query, onSelect, inputRef }: TraceAutocompleteProps) {
    const [results, setResults] = useState<AutocompleteResult[]>([]);
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
            const searchResults = searchAll(query);
            setResults(
                searchResults.map(r => ({
                    type: r.type,
                    id: r.id,
                    displayName: r.description,
                    l2ClusterId: r.l2ClusterId,
                }))
            );
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
                    onSelect({
                        id: results[selectedIndex].id,
                        description: results[selectedIndex].displayName,
                    });
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
                        className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-2 ${index === selectedIndex
                            ? "bg-primary/10 border-l-4 border-primary"
                            : "hover:bg-gray-50 border-l-4 border-transparent"
                            }`}
                        onClick={() => onSelect({
                            id: result.id,
                            description: result.displayName,
                        })}
                        onMouseEnter={() => setSelectedIndex(index)}
                    >
                        {/* Icon: Orb for clusters, document for traces */}
                        <div className="flex-shrink-0">
                            {result.type === "trace" ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    style={{ color: '#6b7280', width: '14px', height: '14px' }}
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                                    />
                                </svg>
                            ) : (
                                <MiniOrb type={result.type} id={result.id} l2ClusterId={result.l2ClusterId} />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                                {result.displayName}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                                ID: {result.id}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
