// src/features/ll-trainer/LLPracticePage.tsx
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { useLLPractice } from "./use-ll-practice";
import { LLTimeBar } from "./LLTimeBar";
import { ScrambleDisplay } from "@/features/solve/ScrambleDisplay";

interface LLPracticePageProps {
  connection: CubeConnection;
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  }
  return seconds.toFixed(2);
}

const PHASE_STATUS: Record<string, string> = {
  idle: "Connect your cube to begin",
  scrambling: "",
  solving_oll: "OLL",
  solving_pll: "PLL",
  done: "Solved!",
};

export function LLPracticePage({ connection }: LLPracticePageProps) {
  const { status, error, connect } = useCubeConnection(connection);
  const {
    phase,
    displayMs,
    trackerState,
    lastCompletion,
    recentCompletions,
  } = useLLPractice(connection);

  const isConnected = status === "connected";

  return (
    <div className="space-y-8">
      {/* Connection status */}
      {!isConnected && (
        <div className="text-center">
          <button
            onClick={connect}
            disabled={status === "connecting"}
            className="rounded bg-blue-600 px-6 py-3 text-lg font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting..." : "Connect Cube"}
          </button>
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      )}

      {/* Previous time bar (shown above scramble during scrambling phase) */}
      {phase === "scrambling" && lastCompletion && (
        <div className="mx-auto max-w-md">
          <LLTimeBar completion={lastCompletion} />
        </div>
      )}

      {/* Scramble display with progress */}
      {phase === "scrambling" && trackerState && (
        <div className="text-center">
          <ScrambleDisplay trackerState={trackerState} />
        </div>
      )}

      {/* Timer */}
      <div className="text-center">
        <p className="font-mono text-6xl font-bold tabular-nums">
          {formatTime(displayMs)}
        </p>
        {PHASE_STATUS[phase] && (
          <p className="mt-2 text-lg text-gray-400">{PHASE_STATUS[phase]}</p>
        )}
      </div>

      {/* Time bar on completion (shown in done phase before auto-advance) */}
      {phase === "done" && lastCompletion && (
        <div className="mx-auto max-w-md">
          <LLTimeBar completion={lastCompletion} />
        </div>
      )}

      {/* Recent attempts log */}
      {recentCompletions.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Recent Attempts</h2>
          <div className="space-y-2">
            {recentCompletions.map((completion, i) => (
              <div
                key={`${completion.timestamp}-${i}`}
                className="rounded bg-gray-800 px-3 py-2"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-mono text-sm tabular-nums text-gray-300">
                    {formatTime(completion.totalTime)}
                  </span>
                  <span className="text-xs text-gray-500">
                    OLL {formatTime(completion.ollTime)} | PLL{" "}
                    {formatTime(completion.pllTime)}
                  </span>
                </div>
                <LLTimeBar completion={completion} compact />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
