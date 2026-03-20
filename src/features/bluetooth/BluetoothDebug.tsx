import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "./use-cube-connection";
import { CubeSvgViewer } from "./CubeSvgViewer";

interface BluetoothDebugProps {
  connection: CubeConnection;
}

const STATUS_COLORS: Record<string, string> = {
  disconnected: "text-red-400",
  connecting: "text-yellow-400",
  connected: "text-green-400",
};

export function BluetoothDebug({ connection }: BluetoothDebugProps) {
  const { status, state, moves, connect, disconnect, resetState } =
    useCubeConnection(connection);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bluetooth Debug</h1>

      {/* Connection status */}
      <div className="flex items-center gap-4">
        <span className={`font-mono ${STATUS_COLORS[status]}`}>{status}</span>
        {status === "disconnected" && (
          <button
            onClick={connect}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
          >
            Connect
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
              onClick={resetState}
              className="rounded bg-yellow-600 px-4 py-2 text-sm font-medium hover:bg-yellow-500"
            >
              Reset State
            </button>
          </>
        )}
      </div>

      {/* Cube state visualization */}
      {status === "connected" && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Cube State</h2>
          <CubeSvgViewer pattern={state} />
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
