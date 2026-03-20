// src/features/solve/SolvePage.tsx
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { useSolveSession } from "./use-solve-session";
import { SolveHistory, formatTime } from "./SolveHistory";

interface SolvePageProps {
  connection: CubeConnection;
}

const PHASE_LABELS: Record<string, string> = {
  idle: "Connect your cube and press Start",
  scrambling: "Apply the scramble to your cube",
  ready: "Scramble verified — start solving!",
  solving: "",
  solved: "Solved!",
};

export function SolvePage({ connection }: SolvePageProps) {
  const { status, connect } = useCubeConnection(connection);
  const { phase, scramble, elapsedMs, recentSolves, startNewSolve } =
    useSolveSession(connection);

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
        </div>
      )}

      {/* Scramble display */}
      {scramble && phase !== "idle" && (
        <div className="text-center">
          <p className="font-mono text-xl tracking-wide">{scramble}</p>
        </div>
      )}

      {/* Timer */}
      <div className="text-center">
        <p className="font-mono text-6xl font-bold tabular-nums">
          {formatTime(elapsedMs)}
        </p>
        <p className="mt-2 text-gray-400">{PHASE_LABELS[phase]}</p>
      </div>

      {/* Start / Next button */}
      {isConnected && (phase === "idle" || phase === "solved") && (
        <div className="text-center">
          <button
            onClick={startNewSolve}
            className="rounded bg-green-600 px-6 py-3 text-lg font-medium hover:bg-green-500"
          >
            {phase === "idle" ? "Start" : "Next Solve"}
          </button>
        </div>
      )}

      {/* Recent solves */}
      {recentSolves.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Recent Solves</h2>
          <SolveHistory solves={recentSolves} />
        </div>
      )}
    </div>
  );
}
