"use client";

/**
 * Three pulsing micro-orbs for loading state
 */
export default function LoadingOrbs() {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-2 h-2 rounded-full bg-gray-300 animate-pulse"
          style={{
            animationDelay: `${i * 0.15}s`,
            animationDuration: "1s",
          }}
        />
      ))}
    </div>
  );
}






