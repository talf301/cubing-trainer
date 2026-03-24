import { connectGanCube } from "gan-web-bluetooth";
import type { GanCubeConnection as GanConn, GanCubeEvent } from "gan-web-bluetooth";
import type { Subscription } from "rxjs";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPuzzle, KPattern } from "cubing/kpuzzle";
import { Move } from "cubing/alg";
import type {
  CubeConnection,
  ConnectionStatus,
  CubeMoveEvent,
} from "@/core/cube-connection";

export class GanBluetoothConnection implements CubeConnection {
  private conn: GanConn | null = null;
  private subscription: Subscription | null = null;
  private kpuzzle: KPuzzle | null = null;
  private currentState: KPattern | null = null;
  private currentStatus: ConnectionStatus = "disconnected";

  private moveListeners = new Set<(event: CubeMoveEvent) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private batteryListeners = new Set<(level: number) => void>();

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  get state(): KPattern | null {
    return this.currentState;
  }

  battery: number | null = null;

  async connect(): Promise<void> {
    if (this.currentStatus === "connecting") return;

    this.setStatus("connecting");

    try {
      this.kpuzzle = await cube3x3x3.kpuzzle();
      this.currentState = this.kpuzzle.defaultPattern();

      this.conn = await connectGanCube(async (_device, isFallbackCall) => {
        if (!isFallbackCall) {
          // Let the library try watchAdvertisements() for automatic MAC detection
          return null;
        }
        // Auto-detection failed — prompt the user as a fallback
        const mac = prompt(
          "Automatic MAC detection unavailable.\n" +
            "Enter cube MAC address (from chrome://bluetooth-internals):\n" +
            "Format: XX:XX:XX:XX:XX:XX",
        );
        return mac;
      });

      this.subscription = this.conn.events$.subscribe(
        (event: GanCubeEvent) => {
          if (event.type === "MOVE") {
            this.handleMove(event.move, event.timestamp);
          } else if (event.type === "BATTERY") {
            this.handleBattery(event.batteryLevel);
          } else if (event.type === "DISCONNECT") {
            this.setStatus("disconnected");
            this.cleanup();
          }
        },
      );

      this.setStatus("connected");
    } catch (error) {
      this.setStatus("disconnected");
      throw error;
    }
  }

  disconnect(): void {
    if (this.conn) {
      void this.conn.disconnect();
    }
    this.cleanup();
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

  addBatteryListener(callback: (level: number) => void): void {
    this.batteryListeners.add(callback);
  }

  removeBatteryListener(callback: (level: number) => void): void {
    this.batteryListeners.delete(callback);
  }

  private handleBattery(level: number): void {
    this.battery = level;
    for (const listener of this.batteryListeners) {
      listener(level);
    }
  }

  private handleMove(moveStr: string, timestamp: number): void {
    if (!this.currentState) return;

    // gan-web-bluetooth gives moves in standard notation: "R", "U'", "F2", etc.
    const move = new Move(moveStr.replace("'", "'"));
    this.currentState = this.currentState.applyMove(move);

    const moveEvent: CubeMoveEvent = {
      move,
      timestamp,
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

  private cleanup(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.conn = null;
  }
}
