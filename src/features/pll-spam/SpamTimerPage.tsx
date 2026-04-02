// src/features/pll-spam/SpamTimerPage.tsx
import { Link } from "react-router-dom";
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { useSpamTimer } from "./use-spam-timer";
import type { PllSpamCompletion, PllSpamDebugInfo } from "@/core/pll-spam-session";

interface SpamTimerPageProps {
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

function AttemptRow({ attempt }: { attempt: PllSpamCompletion }) {
  return (
    <div className="flex items-center justify-between rounded bg-gray-800 px-4 py-2">
      <span className="font-semibold text-gray-200">{attempt.caseName}</span>
      <div className="flex items-center gap-4">
        <span className="font-mono tabular-nums text-gray-300">
          {formatTime(attempt.time)}
        </span>
        <span className="text-sm text-gray-500">
          {attempt.moveCount} moves
        </span>
      </div>
    </div>
  );
}

function DebugPanel({ info }: { info: PllSpamDebugInfo }) {
  return (
    <div className="rounded border border-gray-700 bg-gray-900 p-3 font-mono text-xs">
      <h3 className="mb-1 font-semibold text-gray-400">Debug</h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        <span>Last move:</span>
        <span className="text-gray-300">{info.move}</span>
        <span>Cross:</span>
        <span className={info.crossSolved ? "text-green-400" : "text-red-400"}>
          {info.crossSolved ? "OK" : "BROKEN"}
        </span>
        <span>F2L:</span>
        <span className={info.f2lSolved ? "text-green-400" : "text-red-400"}>
          {info.f2lSolved ? "OK" : "BROKEN"}
        </span>
        <span>OLL:</span>
        <span className={info.ollSolved ? "text-green-400" : "text-red-400"}>
          {info.ollSolved ? "OK" : "BROKEN"}
        </span>
        <span>Baseline:</span>
        <span className="text-gray-300">{info.hasBaseline ? "SET" : "NONE"}</span>
        <span>Moves:</span>
        <span className="text-gray-300">{info.movesSinceBaseline}</span>
        <span>Last result:</span>
        <span className="text-gray-300">{info.lastResult ?? "none"}</span>
      </div>
      {info.unmatchedDelta && (
        <div className="mt-1 text-yellow-400">
          Unmatched delta: c=[{info.unmatchedDelta.corners.join(",")}] e=[{info.unmatchedDelta.edges.join(",")}]
        </div>
      )}
    </div>
  );
}

export function SpamTimerPage({ connection }: SpamTimerPageProps) {
  const { status, error, connect } = useCubeConnection(connection);
  const { lastAttempt, recentAttempts, isPB, debugInfo } = useSpamTimer(connection);

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

      {/* Large time display + case name */}
      <div className="text-center">
        <p className="font-mono text-6xl font-bold tabular-nums">
          {lastAttempt ? formatTime(lastAttempt.time) : "0.00"}
        </p>
        {lastAttempt && (
          <p className="mt-2 text-xl text-gray-300">{lastAttempt.caseName}</p>
        )}
        {isPB && lastAttempt && (
          <p className="mt-1 text-lg font-semibold text-yellow-400">
            PB!
          </p>
        )}
        {isConnected && !lastAttempt && (
          <p className="mt-2 text-gray-400">
            Execute PLLs on a solved cube — always listening
          </p>
        )}
      </div>

      {/* Stats link */}
      <div className="text-center">
        <Link to="/pll-spam/stats" className="text-blue-400 hover:text-blue-300">
          View Stats
        </Link>
      </div>

      {/* Debug panel */}
      {debugInfo && <DebugPanel info={debugInfo} />}

      {/* Scrolling log of recent attempts */}
      {recentAttempts.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Recent Attempts</h2>
          <div className="space-y-1">
            {recentAttempts.map((attempt, i) => (
              <AttemptRow key={`${attempt.timestamp}-${i}`} attempt={attempt} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
