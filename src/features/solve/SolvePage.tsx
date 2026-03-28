// src/features/solve/SolvePage.tsx
import { useState, useEffect } from "react";
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { useSolveSession } from "./use-solve-session";
import { SolveHistory, formatTime } from "./SolveHistory";
import { ScrambleDisplay } from "./ScrambleDisplay";
import type { SmartCubeConnection } from "@/features/bluetooth/smart-cube-connection";
import type { MoYuBluetoothConnection } from "@/features/bluetooth/moyu-bluetooth-connection";

interface SolvePageProps {
  connection: CubeConnection;
}

const PHASE_LABELS: Record<string, string> = {
  idle: "Connect your cube to begin",
  scrambling: "",
  ready: "Scramble verified — start solving!",
  solving: "",
  solved: "Solved!",
};

export function SolvePage({ connection }: SolvePageProps) {
  const { status, error, connect } = useCubeConnection(connection);
  const { phase, displayMs, trackerState, recentSolves } =
    useSolveSession(connection);

  const isConnected = status === "connected";

  // Debug: poll MoYu notification counters
  const [debugInfo, setDebugInfo] = useState("");
  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      const smart = connection as SmartCubeConnection;
      const delegate = smart.debugDelegate as MoYuBluetoothConnection | null;
      if (delegate && "notificationCount" in delegate) {
        const d = delegate as MoYuBluetoothConnection;
        setDebugInfo(
          `notif: ${d.notificationCount}, parsed: ${d.parsedCount}, opcode: 0x${d.lastOpcode.toString(16)}, writeProps: ${d.writeProps}${d.writeError ? `, writeErr: ${d.writeError}` : ""}`
        );
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isConnected, connection]);

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
          {error && (
            <p className="mt-2 text-sm text-red-400">{error}</p>
          )}
        </div>
      )}

      {/* Debug info */}
      {isConnected && debugInfo && (
        <p className="text-center text-xs text-gray-500 font-mono">{debugInfo}</p>
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
        {PHASE_LABELS[phase] && (
          <p className="mt-2 text-gray-400">{PHASE_LABELS[phase]}</p>
        )}
      </div>

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
