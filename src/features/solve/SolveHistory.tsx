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

function SplitTimes({ solve }: { solve: StoredSolve }) {
  if (!solve.splits?.crossTime) return null;

  const { crossTime, f2lTime, ollTime, ollCase, pllCase } = solve.splits;
  const pllTime = solve.duration;

  // Calculate phase durations (time spent in each phase)
  const crossDuration = crossTime;
  const f2lDuration = f2lTime !== undefined ? f2lTime - crossTime : undefined;
  const ollDuration =
    f2lTime !== undefined && ollTime !== undefined
      ? ollTime - f2lTime
      : undefined;
  const pllDuration =
    ollTime !== undefined ? pllTime - ollTime : undefined;

  return (
    <div className="flex gap-2 text-xs text-gray-500">
      <span title="Cross">{formatTime(crossDuration)}</span>
      {f2lDuration !== undefined && (
        <>
          <span className="text-gray-700">|</span>
          <span title="F2L">{formatTime(f2lDuration)}</span>
        </>
      )}
      {ollDuration !== undefined && (
        <>
          <span className="text-gray-700">|</span>
          <span title={ollCase ?? "OLL"}>
            {formatTime(ollDuration)}
            {ollCase && <span className="text-gray-400 ml-1">({ollCase})</span>}
          </span>
        </>
      )}
      {pllDuration !== undefined && (
        <>
          <span className="text-gray-700">|</span>
          <span title={pllCase ?? "PLL"}>
            {formatTime(pllDuration)}
            {pllCase && <span className="text-gray-400 ml-1">({pllCase})</span>}
          </span>
        </>
      )}
    </div>
  );
}

interface SolveHistoryProps {
  solves: StoredSolve[];
}

export function SolveHistory({ solves }: SolveHistoryProps) {
  if (solves.length === 0) {
    return <p className="text-gray-500">No solves yet.</p>;
  }

  return (
    <div className="space-y-2">
      {solves.map((solve, i) => (
        <div key={solve.id} className="font-mono text-sm text-gray-300">
          <div className="flex justify-between">
            <span className="text-gray-500">{i + 1}.</span>
            <span>{formatTime(solve.duration)}</span>
            <span className="text-gray-600 text-xs truncate max-w-[200px]">
              {solve.scramble}
            </span>
          </div>
          <SplitTimes solve={solve} />
        </div>
      ))}
    </div>
  );
}

export { formatTime };
