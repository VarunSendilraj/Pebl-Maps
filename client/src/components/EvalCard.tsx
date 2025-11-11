import React, { useEffect } from "react";
import { z } from "zod";
import { useEvalActions } from "~/contexts/EvalContext";

interface EvalCardProps {
    evalName: string;
    status: string;
}

const EvalCardPropsSchema = z.object({
    evalName: z.string().min(1, "evalName must not be empty"),
    status: z.string().min(1, "status must not be empty"),
});

export default function EvalCard(props: EvalCardProps) {
    // Validate using zod. Will throw if props are missing or empty.
    EvalCardPropsSchema.parse(props);
    const { evalName, status } = props;
    const { setEvalActive } = useEvalActions();

    const isActive = status.toLowerCase() === "active";

    // Update eval status when component mounts or status changes
    useEffect(() => {
        setEvalActive(isActive);
        // Cleanup: set eval to inactive when component unmounts if it was active
        return () => {
            if (isActive) {
                setEvalActive(false);
            }
        };
    }, [isActive, setEvalActive]);
    const statusColor = isActive ? "#10b981" : "#6b7280"; // green-500 for active, gray-500 for inactive

    return (
        <div
            className="max-w-full bg-background border border-gray-300 rounded-lg p-4 mb-4 transition-all duration-200"
            style={{
                backgroundColor: '#ffffff',
            }}
        >
            <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium" style={{ color: '#3d2819' }}>
                    Hallucinating Imports on Coding Tasks
                </div>
                <div className="flex items-center gap-2">
                    {/* Status indicator circle */}
                    <div
                        className="rounded-full"
                        style={{
                            width: '8px',
                            height: '8px',
                            backgroundColor: statusColor,
                            boxShadow: `0 0 4px ${statusColor}80`,
                        }}
                    />
                    <span className="text-xs font-medium" style={{ color: statusColor }}>
                        {status}
                    </span>
                </div>
            </div>
        </div>
    );
}



