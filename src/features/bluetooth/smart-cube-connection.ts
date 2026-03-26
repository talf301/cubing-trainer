/**
 * SmartCubeConnection — unified Bluetooth connection wrapper.
 *
 * Presents a single connect() picker that includes both GAN and MoYu cubes.
 * Based on the selected device name, delegates to the appropriate driver:
 * - WCU_MY3 prefix → MoYuBluetoothConnection (device passed directly)
 * - GAN/MG/AiCube prefix → GanBluetoothConnection (opens second picker via gan-web-bluetooth)
 */

import type {
  CubeConnection,
  ConnectionStatus,
  CubeMoveEvent,
} from "@/core/cube-connection";
import type { KPattern } from "cubing/kpuzzle";
import { GanBluetoothConnection } from "./gan-bluetooth-connection";
import { MoYuBluetoothConnection } from "./moyu-bluetooth-connection";

// ─── BLE filter / service constants ─────────────────────────────────────────

/** MoYu BLE service UUID (needed in optionalServices so GATT can discover it). */
const MOYU_SERVICE_UUID = "0783b03e-7735-b5a0-1760-a305d2795cb0";

/** GAN protocol service UUIDs (Gen2, Gen3, Gen4). */
const GAN_SERVICE_UUIDS = [
  "6e400001-b5a3-f393-e0a9-e50e24dc4179", // Gen2
  "8653000a-43e6-47b7-9cb0-5fc21d4ae340", // Gen3
  "00000010-0000-fff7-fff6-fff5fff4fff0", // Gen4
];

/** Combined Web Bluetooth request filters for all supported cubes. */
const DEVICE_FILTERS: BluetoothLEScanFilter[] = [
  { namePrefix: "GAN" },
  { namePrefix: "MG" },
  { namePrefix: "AiCube" },
  { namePrefix: "WCU_MY3" },
];

/** All service UUIDs that may be needed after pairing. */
const OPTIONAL_SERVICES: BluetoothServiceUUID[] = [
  ...GAN_SERVICE_UUIDS,
  MOYU_SERVICE_UUID,
];

/**
 * MoYu CIC list for optionalManufacturerData.
 * CICs 0x0100–0xFF00: derived from bound account IDs.
 * CIC 0x0000 is excluded — it crashes Chrome (WTF::HashMap disallows 0 as key).
 */
const MOYU_CIC_LIST: number[] = Array.from({ length: 255 }, (_, i) => (i + 1) << 8);

/** GAN CIC list — all values [0x0001..0xFF01]. */
const GAN_CIC_LIST: number[] = Array.from({ length: 256 }, (_, i) => (i << 8) | 0x01);

// ─── Helper ─────────────────────────────────────────────────────────────────

function isMoYuDevice(name: string): boolean {
  return name.startsWith("WCU_MY3");
}

// ─── SmartCubeConnection ────────────────────────────────────────────────────

export class SmartCubeConnection implements CubeConnection {
  private delegate: CubeConnection | null = null;

  // ── Forwarded read-only properties ──────────────────────────────────────

  get status(): ConnectionStatus {
    return this.delegate?.status ?? "disconnected";
  }

  get state(): KPattern | null {
    return this.delegate?.state ?? null;
  }

  get battery(): number | null {
    return this.delegate?.battery ?? null;
  }

  // ── connect ─────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (this.delegate?.status === "connecting") return;

    // Show a single Bluetooth picker for all supported cubes.
    const device = await navigator.bluetooth.requestDevice({
      filters: DEVICE_FILTERS,
      optionalServices: OPTIONAL_SERVICES,
      optionalManufacturerData: [...MOYU_CIC_LIST, ...GAN_CIC_LIST],
    });

    const name = device.name ?? "";

    if (isMoYuDevice(name)) {
      const moyu = new MoYuBluetoothConnection(device);
      this.delegate = moyu;
      this.bindDelegateListeners();
      await moyu.connect();
    } else {
      // GAN / MG / AiCube — delegate to gan-web-bluetooth which opens its own picker.
      const gan = new GanBluetoothConnection();
      this.delegate = gan;
      this.bindDelegateListeners();
      await gan.connect();
    }
  }

  // ── disconnect ──────────────────────────────────────────────────────────

  disconnect(): void {
    this.delegate?.disconnect();
    this.delegate = null;
  }

  // ── resetState ──────────────────────────────────────────────────────────

  resetState(): void {
    this.delegate?.resetState();
  }

  // ── Listener management ─────────────────────────────────────────────────

  private moveListeners = new Set<(event: CubeMoveEvent) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private batteryListeners = new Set<(level: number) => void>();

  addMoveListener(callback: (event: CubeMoveEvent) => void): void {
    this.moveListeners.add(callback);
    this.delegate?.addMoveListener(callback);
  }

  removeMoveListener(callback: (event: CubeMoveEvent) => void): void {
    this.moveListeners.delete(callback);
    this.delegate?.removeMoveListener(callback);
  }

  addStatusListener(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.add(callback);
    this.delegate?.addStatusListener(callback);
  }

  removeStatusListener(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.delete(callback);
    this.delegate?.removeStatusListener(callback);
  }

  addBatteryListener(callback: (level: number) => void): void {
    this.batteryListeners.add(callback);
    this.delegate?.addBatteryListener?.(callback);
  }

  removeBatteryListener(callback: (level: number) => void): void {
    this.batteryListeners.delete(callback);
    this.delegate?.removeBatteryListener?.(callback);
  }

  // ── Internal ────────────────────────────────────────────────────────────

  /**
   * Forward all currently-registered listeners to the newly created delegate.
   * This ensures listeners added before connect() still work.
   */
  private bindDelegateListeners(): void {
    if (!this.delegate) return;

    for (const cb of this.moveListeners) {
      this.delegate.addMoveListener(cb);
    }
    for (const cb of this.statusListeners) {
      this.delegate.addStatusListener(cb);
    }
    for (const cb of this.batteryListeners) {
      this.delegate.addBatteryListener?.(cb);
    }
  }
}
