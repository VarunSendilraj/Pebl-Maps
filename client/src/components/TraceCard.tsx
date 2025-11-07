import React from "react";
import { z } from "zod";
import { useTabs } from "~/contexts/TabsContext";

interface TraceCardProps {
    traceId: string;
    traceDescription: string;
}

const TraceCardPropsSchema = z.object({
    traceId: z.string().min(1, "traceId must not be empty"),
    traceDescription: z.string().min(1, "traceDescription must not be empty"),
});

export default function TraceCard(props: TraceCardProps) {
    const { openTraceTab } = useTabs();

    // Validate using zod. Will throw if props are missing or empty.
    TraceCardPropsSchema.parse(props);
    const { traceId, traceDescription } = props;
    const updateSelectedTrace = () => {
        openTraceTab(traceId, traceDescription);
    };

    return (
        <div
            onClick={updateSelectedTrace}
            className="max-w-full bg-background border border-gray-300 rounded-lg p-4 mb-4 cursor-pointer transition-all duration-200 hover:shadow-lg hover:border-blue-500 hover:bg-gray-50 active:scale-[0.98]"
        >
            <div className="text-sm text-gray-500 mb-1">Trace ID</div>
            <div className="font-mono text-sm mb-3">{traceId}</div>
            <div className="text-sm text-gray-500 mb-1">Description</div>
            <div className="text-sm">{traceDescription}</div>
        </div>
    );
}
