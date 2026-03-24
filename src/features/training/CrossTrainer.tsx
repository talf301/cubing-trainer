// src/features/training/CrossTrainer.tsx
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { useCrossTrainer } from "./use-cross-trainer";
import { ScrambleDisplay } from "@/features/solve/ScrambleDisplay";
import { formatTime } from "@/features/solve/SolveHistory";
import type { CrossTrainerResult } from "@/core/cross-trainer-session";
import { collapseMoves } from "@/core/move-utils";

interface CrossTrainerProps {
  connection: CubeConnection;
}

function ReviewPanel({
  result,
  onNext,
}: {
  result: CrossTrainerResult;
  onNext: () => void;
}) {
  const yourMoves = collapseMoves(result.moves.map((m) => m.move));
  const optimalMoves = result.optimalSolution.toString().split(/\s+/).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Side-by-side comparison */}
      <div className="grid grid-cols-2 gap-4">
        {/* Your cross */}
        <div className="rounded-lg bg-gray-800 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-400">
            Your Cross
          </h3>
          <p className="font-mono text-lg text-white">
            {yourMoves.join(" ")}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {yourMoves.length} move{yourMoves.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Optimal */}
        <div className="rounded-lg bg-gray-800 p-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-400">
            Optimal Cross
          </h3>
          <p className="font-mono text-lg text-green-400">
            {result.optimalSolution.toString()}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {optimalMoves.length} move{optimalMoves.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Undo alg */}
      <div className="rounded-lg bg-gray-800 p-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-400">
          Undo Algorithm
        </h3>
        <p className="font-mono text-base text-yellow-400">
          {result.undoAlg.toString()}
        </p>
      </div>

      {/* Next scramble button */}
      <div className="text-center">
        <button
          onClick={onNext}
          className="rounded bg-blue-600 px-6 py-3 text-lg font-medium hover:bg-blue-500"
        >
          Next Scramble
        </button>
      </div>
    </div>
  );
}

const PHASE_LABELS: Record<string, string> = {
  idle: "Connect your cube to begin",
  scrambling: "",
  ready: "Scramble verified — solve the cross!",
  solving: "",
  review: "",
};

export function CrossTrainer({ connection }: CrossTrainerProps) {
  const { status, connect } = useCubeConnection(connection);
  const { phase, displayMs, trackerState, result, nextScramble } =
    useCrossTrainer(connection);

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

      {/* Scramble display with progress */}
      {phase === "scrambling" && trackerState && (
        <div className="text-center">
          <ScrambleDisplay trackerState={trackerState} />
        </div>
      )}

      {/* Timer */}
      {phase !== "review" && (
        <div className="text-center">
          <p className="font-mono text-6xl font-bold tabular-nums">
            {formatTime(displayMs)}
          </p>
          {PHASE_LABELS[phase] && (
            <p className="mt-2 text-gray-400">{PHASE_LABELS[phase]}</p>
          )}
        </div>
      )}

      {/* Review panel */}
      {phase === "review" && (
        <div>
          <div className="mb-4 text-center">
            <p className="font-mono text-6xl font-bold tabular-nums">
              {formatTime(displayMs)}
            </p>
          </div>
          {result ? (
            <ReviewPanel result={result} onNext={nextScramble} />
          ) : (
            <p className="text-center text-gray-400">
              Computing optimal solution...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
