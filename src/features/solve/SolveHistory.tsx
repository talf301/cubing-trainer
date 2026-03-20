// src/features/solve/SolveHistory.tsx
import type { StoredSolve } from "@/lib/solve-store";

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  }
  return seconds.toFixed(2);
}

interface SolveHistoryProps {
  solves: StoredSolve[];
}

export function SolveHistory({ solves }: SolveHistoryProps) {
  if (solves.length === 0) {
    return <p className="text-gray-500">No solves yet.</p>;
  }

  return (
    <div className="space-y-1">
      {solves.map((solve, i) => (
        <div
          key={solve.id}
          className="flex justify-between font-mono text-sm text-gray-300"
        >
          <span className="text-gray-500">{i + 1}.</span>
          <span>{formatTime(solve.duration)}</span>
          <span className="text-gray-600 text-xs truncate max-w-[200px]">
            {solve.scramble}
          </span>
        </div>
      ))}
    </div>
  );
}

export { formatTime };
