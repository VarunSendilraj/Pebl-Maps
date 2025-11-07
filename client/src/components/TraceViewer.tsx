import { useEffect } from "react";
import { TraceProvider, useTrace } from "~/contexts/TraceContext";

export default function TraceViewer({ isTraceViewerOpen, setIsTraceViewerOpen }: { isTraceViewerOpen: boolean, setIsTraceViewerOpen: (isTraceViewerOpen: boolean) => void }) {
    const { selectedTraceId } = useTrace();

    // Helper functions that fetches trace data using the defined API route.
    const getTraceData = async (traceId: string) => {
        const response = await fetch(`/api/trace?traceId=${traceId}`);
        if (!response.ok) {
            throw new Error(`Failed to fetch trace data: ${response.statusText}`);
        }
        const data = await response.json();
        if (!data.success) {
            throw new Error(`Failed to fetch trace data: ${data.error}`);
        }
        console.log("Successfully fetched trace data for traceId:", traceId);
        return data.traceChunk;
    };

    useEffect(() => {
        // If the selected trace id is not null, fetch the associated trace data (and log it, for now).
        console.log("selectedTraceId:", selectedTraceId);
        if (selectedTraceId) {
            getTraceData(selectedTraceId).then(data => {
                console.log(data);
            }).catch(error => {
                console.error("Error fetching trace data:", error);
            });
        }
    }, [selectedTraceId]);

    return (
        <div className="bg-white border border-gray-300 rounded-lg" style={{ height: "20%" }}>
            <div className="flex items-center justify-between p-4">
                <div className="text-[#8b4a3a] font-bold">Trace Viewer</div>
                <button
                    onClick={() => setIsTraceViewerOpen(false)}
                    className="text-[#8b4a3a] hover:bg-[#8b4a3a]/10 rounded p-1 transition-all"
                    aria-label="Close trace viewer"
                >
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
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
        </div>
    );
}