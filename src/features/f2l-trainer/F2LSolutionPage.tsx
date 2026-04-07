// src/features/f2l-trainer/F2LSolutionPage.tsx
import { Link } from "react-router-dom";
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { useF2LSolution } from "./use-f2l-solution";
import { F2LCaseViewer } from "./F2LCaseViewer";

interface F2LSolutionPageProps {
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

export function F2LSolutionPage({ connection }: F2LSolutionPageProps) {
  const { status, error, connect } = useCubeConnection(connection);
  const { phase, caseName, caseKey, moves, timerMs, result, hintAlgorithm, skip, next, retry } =
    useF2LSolution(connection);

  const isConnected = status === "connected";

  return (
    <div className="flex h-full flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2">
        <Link to="/training" className="text-blue-400 hover:text-blue-300">
          ← Training
        </Link>
        {caseName && (
          <span className="text-lg font-semibold text-gray-200">
            {caseName}
          </span>
        )}
        <Link
          to="/training/f2l/stats"
          className="text-blue-400 hover:text-blue-300"
        >
          Stats
        </Link>
      </div>

      {/* Connection prompt */}
      {!isConnected && (
        <div className="flex flex-1 items-center justify-center">
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
        </div>
      )}

      {/* Main content when connected */}
      {isConnected && (
        <>
          {/* Hint algorithm (shown during retry) */}
          {hintAlgorithm && phase !== "review" && (
            <p className="px-4 text-center font-mono text-sm text-yellow-400">
              {hintAlgorithm}
            </p>
          )}

          {/* 3D model — takes up available space */}
          <div className="flex flex-1 items-center justify-center">
            {caseName ? (
              <F2LCaseViewer key={caseKey} caseName={caseName} moves={moves} />
            ) : (
              <p className="text-gray-400">Loading case…</p>
            )}
          </div>

          {/* Timer */}
          <div className="py-2 text-center">
            <p className="font-mono text-5xl font-bold tabular-nums">
              {formatTime(timerMs)}
            </p>
            {/* Review info */}
            {phase === "review" && result && (
              <div className="mt-2 space-y-1">
                <p className="text-lg text-gray-300">
                  {result.moveCount} moves
                  {result.optimal ? (
                    <span className="ml-2 text-green-400">Optimal</span>
                  ) : (
                    <span className="ml-2 text-yellow-400">
                      (optimal: {result.shortestMoveCount})
                    </span>
                  )}
                </p>
                <div className="mt-2 space-y-1">
                  {result.algorithms.map((alg, i) => {
                    const moveCount = alg.trim().split(/\s+/).length;
                    return (
                      <p key={i} className="font-mono text-sm text-gray-400">
                        <span className="mr-2 text-gray-500">{moveCount}</span>
                        {alg}
                      </p>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-center gap-4 px-4 py-4">
            {(phase === "presenting" || phase === "solving") && (
              <>
                <button
                  onClick={retry}
                  className="rounded bg-gray-700 px-6 py-2 text-gray-300 hover:bg-gray-600"
                >
                  Reset
                </button>
                <button
                  onClick={skip}
                  className="rounded bg-gray-700 px-6 py-2 text-gray-300 hover:bg-gray-600"
                >
                  Skip
                </button>
              </>
            )}
            {phase === "review" && (
              <div className="flex gap-4">
                <button
                  onClick={retry}
                  className="rounded bg-gray-700 px-6 py-2 text-gray-300 hover:bg-gray-600"
                >
                  Retry
                </button>
                <button
                  onClick={next}
                  className="rounded bg-blue-600 px-6 py-2 font-medium hover:bg-blue-500"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
