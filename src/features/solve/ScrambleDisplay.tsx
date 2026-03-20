// src/features/solve/ScrambleDisplay.tsx
import type { ScrambleTrackerState } from "@/core/scramble-tracker";

interface ScrambleDisplayProps {
  trackerState: ScrambleTrackerState;
}

export function ScrambleDisplay({ trackerState }: ScrambleDisplayProps) {
  if (trackerState.mode === "recovering") {
    return (
      <div className="flex flex-wrap justify-center gap-2 font-mono text-xl">
        {trackerState.recoveryMoves.map((move, i) => (
          <span key={i} className="text-red-400">
            {move}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-2 font-mono text-xl">
      {trackerState.scrambleMoves.map((move, i) => (
        <span
          key={i}
          className={move.completed ? "text-green-400" : "text-white"}
        >
          {move.move}
        </span>
      ))}
    </div>
  );
}
