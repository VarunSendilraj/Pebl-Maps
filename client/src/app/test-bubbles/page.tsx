import BubbleCanvas from "~/components/bubbles/BubbleCanvas";
import { dummyClusterData } from "~/lib/bubbles/dummyData";

export default function BubblesTestPage() {
  return (
    <main className="min-h-screen w-full bg-background p-8">
      <div className="mx-auto max-w-[1600px]">
        <h1 className="mb-6 text-3xl font-bold text-foreground">Bubble Canvas Test Page</h1>
        <div className="w-full rounded-lg border border-slate-200 bg-white p-6 shadow-lg" style={{ height: '600px' }}>
          <BubbleCanvas data={dummyClusterData} />
        </div>
      </div>
    </main>
  );
}

