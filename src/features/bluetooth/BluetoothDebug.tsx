// src/features/bluetooth/BluetoothDebug.tsx
import { useState } from "react";
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "./use-cube-connection";
import { CubeViewer } from "./CubeViewer";

interface BluetoothDebugProps {
  connection: CubeConnection;
}

const STATUS_COLORS: Record<string, string> = {
  disconnected: "text-red-400",
  connecting: "text-yellow-400",
  connected: "text-green-400",
};

export function BluetoothDebug({ connection }: BluetoothDebugProps) {
  const { status, moves, battery, error, connect, disconnect, resetState } =
    useCubeConnection(connection);
  const [resetCount, setResetCount] = useState(0);

  const handleReset = () => {
    resetState();
    setResetCount((c) => c + 1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bluetooth Debug</h1>

      {/* Connection status */}
      <div className="flex items-center gap-4">
        <span className={`font-mono ${STATUS_COLORS[status]}`}>{status}</span>
        {status === "connected" && battery != null && (
          <span className="text-sm text-gray-300">Battery: {battery}%</span>
        )}
        {(status === "disconnected" || status === "connecting") && (
          <button
            onClick={connect}
            disabled={status === "connecting"}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting..." : "Connect"}
          </button>
        )}
        {status === "connected" && (
          <>
            <button
              onClick={disconnect}
              className="rounded bg-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-500"
            >
              Disconnect
            </button>
            <button
              onClick={handleReset}
              className="rounded bg-yellow-600 px-4 py-2 text-sm font-medium hover:bg-yellow-500"
            >
              Reset State
            </button>
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded bg-red-900/50 px-4 py-2 text-sm text-red-300">
          Error: {error}
        </div>
      )}

      {/* Cube state visualization */}
      {status === "connected" && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Cube State</h2>
          <CubeViewer moves={moves} instanceKey={resetCount} />
        </div>
      )}

      {/* Move log */}
      {moves.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">
            Recent Moves ({moves.length})
          </h2>
          <div className="font-mono text-sm text-gray-300">
            {moves.map((m, i) => (
              <span key={i} className="mr-2">
                {m.move.toString()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
