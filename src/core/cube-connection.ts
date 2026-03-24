import type { KPattern } from "cubing/kpuzzle";
import type { Move } from "cubing/alg";

export interface CubeMoveEvent {
  move: Move;
  timestamp: number;
  state: KPattern;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface CubeConnection {
  connect(): Promise<void>;
  disconnect(): void;
  resetState(): void;

  readonly status: ConnectionStatus;
  readonly state: KPattern | null;
  readonly battery: number | null;

  addMoveListener(callback: (event: CubeMoveEvent) => void): void;
  removeMoveListener(callback: (event: CubeMoveEvent) => void): void;

  addStatusListener(callback: (status: ConnectionStatus) => void): void;
  removeStatusListener(callback: (status: ConnectionStatus) => void): void;

  addBatteryListener?(callback: (level: number) => void): void;
  removeBatteryListener?(callback: (level: number) => void): void;
}
