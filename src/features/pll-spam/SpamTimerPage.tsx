// src/features/pll-spam/SpamTimerPage.tsx
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { useSpamTimer } from "./use-spam-timer";
import type { PllSpamCompletion } from "@/core/pll-spam-session";

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

export function SpamTimerPage({ connection }: SpamTimerPageProps) {
  const { status, error, connect } = useCubeConnection(connection);
  const { lastAttempt, recentAttempts, isPB } = useSpamTimer(connection);

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
