import React from "react";

interface OnlineEvalCardProps {
    status?: "active" | "inactive";
}

export default function OnlineEvalCard({ status = "active" }: OnlineEvalCardProps) {
    return (
        <div
            className="max-w-full bg-background border rounded-lg p-4 mb-4 transition-all duration-200"
            style={{
                backgroundColor: '#ffffff',
                borderColor: '#d8d3cb',
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
            }}
        >
            <div className="flex items-center justify-between mb-3">
                <div className="text-sm font-medium" style={{ color: '#3d2819' }}>
                    Online Eval: AI Jailbreak Detection
                </div>
                {status === "active" && (
                    <div
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                        style={{
                            backgroundColor: '#d1fae5',
                            color: '#065f46',
                        }}
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={2}
                            stroke="currentColor"
                            className="w-3.5 h-3.5"
                        >
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="text-xs font-medium">Active</span>
                    </div>
                )}
            </div>
            <div className="text-sm" style={{ color: '#8a817c' }}>
                Monitoring and tracking all future AI jailbreak attempts
            </div>
        </div>
    );
}



