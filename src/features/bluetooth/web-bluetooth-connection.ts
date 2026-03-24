// src/features/bluetooth/web-bluetooth-connection.ts
import { connectSmartPuzzle } from "cubing/bluetooth";
import type { BluetoothPuzzle, MoveEvent as BtMoveEvent } from "cubing/bluetooth";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPuzzle, KPattern } from "cubing/kpuzzle";
import { Move } from "cubing/alg";
import type {
  CubeConnection,
  ConnectionStatus,
  CubeMoveEvent,
} from "@/core/cube-connection";

export class WebBluetoothCubeConnection implements CubeConnection {
  private puzzle: BluetoothPuzzle | null = null;
  private kpuzzle: KPuzzle | null = null;
  private currentState: KPattern | null = null;
  private currentStatus: ConnectionStatus = "disconnected";

  private moveListeners = new Set<(event: CubeMoveEvent) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  get state(): KPattern | null {
    return this.currentState;
  }

  readonly battery: number | null = null;

  async connect(): Promise<void> {
    if (this.currentStatus === "connecting") return;

    this.setStatus("connecting");

    try {
      this.kpuzzle = await cube3x3x3.kpuzzle();
      this.currentState = this.kpuzzle.defaultPattern();

      this.puzzle = await connectSmartPuzzle();

      this.puzzle.addAlgLeafListener((event: BtMoveEvent) => {
        this.handleMove(event);
      });

      // Detect disconnection. Try the BluetoothPuzzle's EventTarget first;
      // if that doesn't fire, the GATT server disconnected event is the fallback.
      this.puzzle.addEventListener("disconnected", () => {
        this.setStatus("disconnected");
        this.puzzle = null;
      });

      this.setStatus("connected");
    } catch (error) {
      this.setStatus("disconnected");
      throw error;
    }
  }

  disconnect(): void {
    if (this.puzzle) {
      this.puzzle.disconnect();
      this.puzzle = null;
    }
    this.setStatus("disconnected");
  }

  resetState(): void {
    if (this.kpuzzle) {
      this.currentState = this.kpuzzle.defaultPattern();
    }
  }

  addMoveListener(callback: (event: CubeMoveEvent) => void): void {
    this.moveListeners.add(callback);
  }

  removeMoveListener(callback: (event: CubeMoveEvent) => void): void {
    this.moveListeners.delete(callback);
  }

  addStatusListener(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.add(callback);
  }

  removeStatusListener(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.delete(callback);
  }

  private handleMove(event: BtMoveEvent): void {
    if (!this.currentState) return;

    const move = event.latestAlgLeaf;
    if (!(move instanceof Move)) return;

    this.currentState = this.currentState.applyMove(move);

    const moveEvent: CubeMoveEvent = {
      move,
      timestamp: event.timeStamp,
      state: this.currentState,
    };

    for (const listener of this.moveListeners) {
      listener(moveEvent);
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}
