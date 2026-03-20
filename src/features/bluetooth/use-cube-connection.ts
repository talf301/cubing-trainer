// src/features/bluetooth/use-cube-connection.ts
import { useState, useEffect, useCallback } from "react";
import type {
  CubeConnection,
  ConnectionStatus,
  CubeMoveEvent,
} from "@/core/cube-connection";
import type { KPattern } from "cubing/kpuzzle";

// Enough moves for a debug view without unbounded growth
const MAX_MOVE_HISTORY = 50;

export function useCubeConnection(connection: CubeConnection) {
  const [status, setStatus] = useState<ConnectionStatus>(connection.status);
  const [state, setState] = useState<KPattern | null>(connection.state);
  const [moves, setMoves] = useState<CubeMoveEvent[]>([]);

  useEffect(() => {
    const onStatus = (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
    };

    const onMove = (event: CubeMoveEvent) => {
      setState(event.state);
      setMoves((prev) => [...prev, event].slice(-MAX_MOVE_HISTORY));
    };

    connection.addStatusListener(onStatus);
    connection.addMoveListener(onMove);

    return () => {
      connection.removeStatusListener(onStatus);
      connection.removeMoveListener(onMove);
    };
  }, [connection]);

  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    try {
      setError(null);
      await connection.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      console.error("Connection failed:", e);
    }
  }, [connection]);

  const disconnect = useCallback(() => {
    connection.disconnect();
  }, [connection]);

  const resetState = useCallback(() => {
    connection.resetState();
    setState(connection.state);
    setMoves([]);
  }, [connection]);

  return { status, state, moves, error, connect, disconnect, resetState };
}
