/**
 * MoYu Bluetooth smart cube driver.
 *
 * Ported from cstimer moyu32cube.js — implements the MoYu V10/V11 BLE protocol
 * with AES-128 encryption, facelet parsing, and move tracking.
 *
 * Protocol overview:
 * - Service: 0783b03e-7735-b5a0-1760-a305d2795cb0
 * - Read characteristic (notifications): …cb1
 * - Write characteristic (requests): …cb2
 * - 20-byte messages encrypted with AES-128-ECB + IV XOR (two overlapping blocks)
 * - Key/IV derived from cube's Bluetooth MAC address
 * - Opcodes: 0xA1=info, 0xA3=facelets, 0xA4=battery, 0xA5=moves
 */

import { cube3x3x3 } from "cubing/puzzles";
import type { KPuzzle, KPattern, KPatternData } from "cubing/kpuzzle";
import { Move } from "cubing/alg";
import type {
  CubeConnection,
  ConnectionStatus,
  CubeMoveEvent,
} from "@/core/cube-connection";

// ─── BLE UUIDs ──────────────────────────────────────────────────────────────

const SERVICE_UUID = "0783b03e-7735-b5a0-1760-a305d2795cb0";
const CHRT_UUID_READ = "0783b03e-7735-b5a0-1760-a305d2795cb1";
const CHRT_UUID_WRITE = "0783b03e-7735-b5a0-1760-a305d2795cb2";

// ─── AES key/IV base constants ──────────────────────────────────────────────
// Pre-decompressed from the LZString-encoded cstimer values.

const KEY_BASE = new Uint8Array([
  21, 119, 58, 92, 103, 14, 45, 31, 23, 103, 42, 19, 155, 103, 82, 87,
]);
const IV_BASE = new Uint8Array([
  17, 35, 38, 37, 134, 42, 44, 59, 85, 6, 127, 49, 126, 103, 33, 87,
]);

// ─── Cube face / sticker constants ──────────────────────────────────────────

/** MoYu protocol face order (for sticker color index & move encoding). */
const MOYU_FACES = "FBUDLR";

/** Standard Kociemba face order (for facelet strings). */
const STD_FACES = "URFDLB";

/**
 * Maps MoYu protocol face index to output face index for URFDLB reordering.
 * Protocol order: F=0 B=1 U=2 D=3 L=4 R=5
 * Output order:   U=0 R=1 F=2 D=3 L=4 B=5
 * Entry i = protocol face index for output face i.
 */
const FACE_REORDER = [2, 5, 0, 3, 4, 1] as const;

// ─── Facelet-to-KPattern tables ─────────────────────────────────────────────
// Facelet indices use Kociemba URFDLB ordering (0-53), 9 per face, row-major.
// Face offsets: U=0, R=9, F=18, D=27, L=36, B=45

/**
 * Corner position facelets: [U/D-ref, clockwise-1, clockwise-2].
 * Indexed by cubing.js corner piece index.
 */
export const CORNER_FACELETS: ReadonlyArray<readonly [number, number, number]> =
  [
    [8, 9, 20], //  0: UFR → U8  R0  F2
    [2, 45, 11], // 1: UBR → U2  B0  R2
    [0, 36, 47], // 2: UBL → U0  L0  B2
    [6, 18, 38], // 3: UFL → U6  F0  L2
    [29, 26, 15], // 4: DFR → D2  F8  R6
    [27, 44, 24], // 5: DFL → D0  L8  F6
    [33, 53, 42], // 6: DBL → D6  B8  L6
    [35, 17, 51], // 7: DBR → D8  R8  B6
  ];

/**
 * Corner piece colors: [ref, clockwise-1, clockwise-2].
 * ref is always U or D. Indexed by cubing.js corner piece index.
 */
const CORNER_COLORS: ReadonlyArray<readonly [string, string, string]> = [
  ["U", "R", "F"], // 0: UFR
  ["U", "B", "R"], // 1: UBR
  ["U", "L", "B"], // 2: UBL
  ["U", "F", "L"], // 3: UFL
  ["D", "F", "R"], // 4: DFR
  ["D", "L", "F"], // 5: DFL
  ["D", "B", "L"], // 6: DBL
  ["D", "R", "B"], // 7: DBR
];

/**
 * Edge position facelets: [ref, other].
 * ref = U/D for UD-layer edges, F/B for E-layer edges.
 * Indexed by cubing.js edge piece index.
 */
export const EDGE_FACELETS: ReadonlyArray<readonly [number, number]> = [
  [7, 19], //   0: UF  → U7  F1
  [5, 10], //   1: UR  → U5  R1
  [1, 46], //   2: UB  → U1  B1
  [3, 37], //   3: UL  → U3  L1
  [28, 25], //  4: DF  → D1  F7
  [32, 16], //  5: DR  → D5  R7
  [34, 52], //  6: DB  → D7  B7
  [30, 43], //  7: DL  → D3  L7
  [23, 12], //  8: FR  → F5  R3
  [21, 41], //  9: FL  → F3  L5
  [48, 14], // 10: BR  → B3  R5
  [50, 39], // 11: BL  → B5  L3
];

/**
 * Edge piece colors: [ref, other]. Indexed by cubing.js edge piece index.
 */
const EDGE_COLORS: ReadonlyArray<readonly [string, string]> = [
  ["U", "F"], // 0: UF
  ["U", "R"], // 1: UR
  ["U", "B"], // 2: UB
  ["U", "L"], // 3: UL
  ["D", "F"], // 4: DF
  ["D", "R"], // 5: DR
  ["D", "B"], // 6: DB
  ["D", "L"], // 7: DL
  ["F", "R"], // 8: FR
  ["F", "L"], // 9: FL
  ["B", "R"], // 10: BR
  ["B", "L"], // 11: BL
];

// ─── Lookup tables (built once) ─────────────────────────────────────────────

/** Corner lookup: sorted color triple → piece index. */
const CORNER_LOOKUP = new Map<string, number>();
for (let i = 0; i < 8; i++) {
  CORNER_LOOKUP.set([...CORNER_COLORS[i]].sort().join(""), i);
}

/** Edge lookup: sorted color pair → piece index. */
const EDGE_LOOKUP = new Map<string, number>();
for (let i = 0; i < 12; i++) {
  EDGE_LOOKUP.set([...EDGE_COLORS[i]].sort().join(""), i);
}

// ─── AES-128-ECB via Web Crypto ─────────────────────────────────────────────

const ZERO_IV = new Uint8Array(16);
const FULL_PADDING = new Uint8Array(16).fill(0x10); // PKCS7 padding block

/**
 * AES-128-ECB encrypt a single 16-byte block via Web Crypto.
 * Uses AES-CBC with zero IV; takes first 16 bytes of output.
 */
async function ecbEncryptBlock(
  key: CryptoKey,
  block: Uint8Array,
): Promise<Uint8Array> {
  const result = await crypto.subtle.encrypt(
    { name: "AES-CBC", iv: ZERO_IV },
    key,
    block,
  );
  return new Uint8Array(result, 0, 16);
}

/**
 * AES-128-ECB decrypt a single 16-byte block via Web Crypto.
 *
 * Trick: build a 32-byte ciphertext [block, C2] where C2 is chosen so that
 * CBC decryption of block 2 produces valid PKCS7 padding (16× 0x10).
 * Then CBC decrypt with zero IV gives [AES_dec(block), (padding stripped)].
 */
async function ecbDecryptBlock(
  key: CryptoKey,
  block: Uint8Array,
): Promise<Uint8Array> {
  // padPlain = FULL_PADDING XOR block
  const padPlain = new Uint8Array(16);
  for (let i = 0; i < 16; i++) padPlain[i] = FULL_PADDING[i] ^ block[i];

  // C2 = AES_encrypt(padPlain) — ensures AES_dec(C2) XOR block = FULL_PADDING
  const c2 = await ecbEncryptBlock(key, padPlain);

  // CBC decrypt [block, C2] with zero IV
  const input = new Uint8Array(32);
  input.set(block, 0);
  input.set(c2, 16);

  const result = await crypto.subtle.decrypt(
    { name: "AES-CBC", iv: ZERO_IV },
    key,
    input,
  );
  // result is 16 bytes (second block was padding, stripped by PKCS7)
  return new Uint8Array(result);
}

// ─── MoYu cipher ────────────────────────────────────────────────────────────

/**
 * Derive AES key and IV byte arrays from 6 MAC address bytes.
 * Matches cstimer getKeyAndIv().
 */
export function deriveKeyAndIv(macBytes: Uint8Array): {
  key: Uint8Array;
  iv: Uint8Array;
} {
  const key = new Uint8Array(16);
  const iv = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    key[i] = KEY_BASE[i];
    iv[i] = IV_BASE[i];
  }
  // First 6 bytes are modified using the MAC (reversed)
  for (let i = 0; i < 6; i++) {
    key[i] = (key[i] + macBytes[5 - i]) % 255;
    iv[i] = (iv[i] + macBytes[5 - i]) % 255;
  }
  return { key, iv };
}

/**
 * Parse a MAC address string ("XX:XX:XX:XX:XX:XX") into 6 bytes.
 */
export function parseMacAddress(mac: string): Uint8Array {
  const bytes = new Uint8Array(6);
  for (let i = 0; i < 6; i++) {
    bytes[i] = parseInt(mac.slice(i * 3, i * 3 + 2), 16);
  }
  return bytes;
}

export interface MoYuCipher {
  decrypt(data: Uint8Array): Promise<Uint8Array>;
  encrypt(data: Uint8Array): Promise<Uint8Array>;
}

/**
 * Create an AES cipher for MoYu protocol from a MAC address string.
 */
export async function createMoYuCipher(macAddress: string): Promise<MoYuCipher> {
  const macBytes = parseMacAddress(macAddress);
  const { key: keyBytes, iv } = deriveKeyAndIv(macBytes);

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-CBC" },
    false,
    ["encrypt", "decrypt"],
  );

  return {
    /**
     * Decrypt a 20-byte message from the cube.
     * Two overlapping 16-byte ECB blocks, each XORed with IV.
     */
    async decrypt(data: Uint8Array): Promise<Uint8Array> {
      const ret = new Uint8Array(data);

      if (ret.length > 16) {
        // Decrypt last 16 bytes
        const offset = ret.length - 16;
        const tail = await ecbDecryptBlock(key, ret.slice(offset));
        for (let i = 0; i < 16; i++) {
          ret[offset + i] = tail[i] ^ iv[i];
        }
      }

      // Decrypt first 16 bytes (may overlap with modified tail)
      const head = await ecbDecryptBlock(key, ret.slice(0, 16));
      for (let i = 0; i < 16; i++) {
        ret[i] = head[i] ^ iv[i];
      }

      return ret;
    },

    /**
     * Encrypt a 20-byte message to send to the cube.
     */
    async encrypt(data: Uint8Array): Promise<Uint8Array> {
      const ret = new Uint8Array(data);

      // XOR first 16 bytes with IV, then ECB encrypt
      for (let i = 0; i < 16; i++) {
        ret[i] ^= iv[i];
      }
      const headEnc = await ecbEncryptBlock(key, ret.slice(0, 16));
      ret.set(headEnc, 0);

      if (ret.length > 16) {
        // XOR last 16 bytes with IV, then ECB encrypt
        const offset = ret.length - 16;
        const block = ret.slice(offset);
        for (let i = 0; i < 16; i++) {
          block[i] ^= iv[i];
        }
        const tailEnc = await ecbEncryptBlock(key, block);
        ret.set(tailEnc, offset);
      }

      return ret;
    },
  };
}

// ─── Message parsing ────────────────────────────────────────────────────────

/** Convert a byte array to a binary string (8 bits per byte). */
export function bytesToBits(bytes: Uint8Array): string {
  let bits = "";
  for (let i = 0; i < bytes.length; i++) {
    bits += (bytes[i] + 256).toString(2).slice(1);
  }
  return bits;
}

/**
 * Parse MoYu facelet bits (144 bits = 6 faces × 8 stickers × 3 bits)
 * into a 54-character URFDLB facelet string.
 *
 * The protocol sends faces in FBUDLR order. Each sticker is a 3-bit color
 * index into "FBUDLR". This function reorders to URFDLB and inserts centers.
 */
export function parseMoYuFacelets(faceletBits: string): string {
  const state: string[] = [];

  for (let i = 0; i < 6; i++) {
    const protocolFace = FACE_REORDER[i];
    const faceBits = faceletBits.slice(protocolFace * 24, protocolFace * 24 + 24);

    for (let j = 0; j < 8; j++) {
      const colorIdx = parseInt(faceBits.slice(j * 3, j * 3 + 3), 2);
      state.push(MOYU_FACES[colorIdx]);

      // Insert center sticker after the 4th edge sticker
      if (j === 3) {
        state.push(MOYU_FACES[protocolFace]);
      }
    }
  }

  return state.join("");
}

/** Parsed move from the MoYu move buffer. */
export interface MoYuBufferedMove {
  face: string; // "U", "R", "F", "D", "L", "B"
  direction: "CW" | "CCW";
  timeOffset: number; // milliseconds since previous move
}

/** Parsed message from the cube. */
export type MoYuMessage =
  | { type: "info"; deviceName: string; softwareVersion: string; hardwareVersion: string }
  | { type: "facelets"; facelets: string; moveCount: number }
  | { type: "battery"; level: number }
  | { type: "moves"; moveCount: number; moves: MoYuBufferedMove[] };

/**
 * Parse a decrypted 20-byte message into a typed object.
 */
export function parseMessage(data: Uint8Array): MoYuMessage | null {
  const bits = bytesToBits(data);
  const opcode = data[0];

  if (opcode === 0xa1) {
    // Info message
    let deviceName = "";
    for (let i = 0; i < 8; i++) {
      deviceName += String.fromCharCode(parseInt(bits.slice(8 + i * 8, 16 + i * 8), 2));
    }
    const softwareVersion =
      parseInt(bits.slice(72, 80), 2) + "." + parseInt(bits.slice(80, 88), 2);
    const hardwareVersion =
      parseInt(bits.slice(88, 96), 2) + "." + parseInt(bits.slice(96, 104), 2);
    return { type: "info", deviceName: deviceName.trim(), softwareVersion, hardwareVersion };
  }

  if (opcode === 0xa3) {
    // Facelet state
    const moveCount = parseInt(bits.slice(152, 160), 2);
    const facelets = parseMoYuFacelets(bits.slice(8, 152));
    return { type: "facelets", facelets, moveCount };
  }

  if (opcode === 0xa4) {
    // Battery level
    const level = data[1];
    return { type: "battery", level };
  }

  if (opcode === 0xa5) {
    // Move event (buffer of up to 5 recent moves)
    const moveCount = parseInt(bits.slice(88, 96), 2);
    const moves: MoYuBufferedMove[] = [];

    for (let i = 0; i < 5; i++) {
      const m = parseInt(bits.slice(96 + i * 5, 101 + i * 5), 2);
      const timeOffset = parseInt(bits.slice(8 + i * 16, 24 + i * 16), 2);

      if (m >= 12) break; // Invalid move — stop parsing

      const face = MOYU_FACES[m >> 1];
      // Convert FBUDLR face names to standard URFDLB
      const stdFace = STD_FACES[STD_FACES.indexOf(face) >= 0 ? STD_FACES.indexOf(face) : 0];
      const direction: "CW" | "CCW" = (m & 1) === 0 ? "CW" : "CCW";
      moves.push({ face: stdFace, direction, timeOffset });
    }

    return { type: "moves", moveCount, moves };
  }

  return null; // Unknown opcode
}

// ─── Facelet-to-KPattern conversion ─────────────────────────────────────────

/**
 * Convert a 54-character URFDLB facelet string to a cubing.js KPattern.
 *
 * Decomposes the facelet string into CORNERS and EDGES orbit data by:
 * 1. Identifying which piece is at each position from its sticker colors
 * 2. Determining orientation from the reference sticker position
 * 3. Validating permutation and orientation parity
 *
 * @throws Error if the facelet string represents an invalid cube state
 */
export function faceletToKPattern(
  facelets: string,
  kpuzzle: KPuzzle,
): KPattern {
  if (facelets.length !== 54) {
    throw new Error(`Expected 54 facelets, got ${facelets.length}`);
  }

  // Validate all characters are valid face colors
  for (let i = 0; i < 54; i++) {
    if (!"URFDLB".includes(facelets[i])) {
      throw new Error(`Invalid facelet color '${facelets[i]}' at index ${i}`);
    }
  }

  const cornerPieces = new Array<number>(8);
  const cornerOrient = new Array<number>(8);
  const edgePieces = new Array<number>(12);
  const edgeOrient = new Array<number>(12);

  // Decode corners
  const usedCorners = new Set<number>();
  for (let pos = 0; pos < 8; pos++) {
    const [f0, f1, f2] = CORNER_FACELETS[pos];
    const c0 = facelets[f0];
    const c1 = facelets[f1];
    const c2 = facelets[f2];

    const sortedKey = [c0, c1, c2].sort().join("");
    const piece = CORNER_LOOKUP.get(sortedKey);
    if (piece === undefined) {
      throw new Error(`Invalid corner at position ${pos}: ${c0}${c1}${c2}`);
    }
    if (usedCorners.has(piece)) {
      throw new Error(`Duplicate corner piece ${piece}`);
    }
    usedCorners.add(piece);

    // Find orientation: where is the reference (U/D) sticker?
    const refColor = CORNER_COLORS[piece][0]; // U or D
    let orient: number;
    if (c0 === refColor) orient = 0;
    else if (c1 === refColor) orient = 1;
    else if (c2 === refColor) orient = 2;
    else throw new Error(`Corner piece ${piece} has no ref sticker at position ${pos}`);

    cornerPieces[pos] = piece;
    cornerOrient[pos] = orient;
  }

  // Decode edges
  const usedEdges = new Set<number>();
  for (let pos = 0; pos < 12; pos++) {
    const [f0, f1] = EDGE_FACELETS[pos];
    const c0 = facelets[f0];
    const c1 = facelets[f1];

    const sortedKey = [c0, c1].sort().join("");
    const piece = EDGE_LOOKUP.get(sortedKey);
    if (piece === undefined) {
      throw new Error(`Invalid edge at position ${pos}: ${c0}${c1}`);
    }
    if (usedEdges.has(piece)) {
      throw new Error(`Duplicate edge piece ${piece}`);
    }
    usedEdges.add(piece);

    // Find orientation: is the reference sticker at slot 0?
    const refColor = EDGE_COLORS[piece][0];
    const orient = c0 === refColor ? 0 : 1;

    edgePieces[pos] = piece;
    edgeOrient[pos] = orient;
  }

  // Parity validation
  const cornerOrientSum = cornerOrient.reduce((a, b) => a + b, 0);
  if (cornerOrientSum % 3 !== 0) {
    throw new Error(
      `Invalid corner orientation parity: sum=${cornerOrientSum} (must be divisible by 3)`,
    );
  }

  const edgeOrientSum = edgeOrient.reduce((a, b) => a + b, 0);
  if (edgeOrientSum % 2 !== 0) {
    throw new Error(
      `Invalid edge orientation parity: sum=${edgeOrientSum} (must be even)`,
    );
  }

  // Permutation parity check: corners and edges must have same parity
  const cornerParity = permutationParity(cornerPieces);
  const edgeParity = permutationParity(edgePieces);
  if (cornerParity !== edgeParity) {
    throw new Error(
      `Permutation parity mismatch: corners=${cornerParity}, edges=${edgeParity}`,
    );
  }

  const patternData: KPatternData = {
    EDGES: { pieces: edgePieces, orientation: edgeOrient },
    CORNERS: { pieces: cornerPieces, orientation: cornerOrient },
    CENTERS: {
      pieces: [0, 1, 2, 3, 4, 5],
      orientation: [0, 0, 0, 0, 0, 0],
      orientationMod: [1, 1, 1, 1, 1, 1],
    },
  };

  return new (kpuzzle.defaultPattern().constructor as typeof KPattern)(
    kpuzzle,
    patternData,
  );
}

/**
 * Compute the parity of a permutation (0 = even, 1 = odd).
 * Uses cycle counting: parity = (n - number_of_cycles) mod 2.
 */
function permutationParity(perm: number[]): number {
  const visited = new Array<boolean>(perm.length).fill(false);
  let cycles = 0;
  for (let i = 0; i < perm.length; i++) {
    if (!visited[i]) {
      cycles++;
      let j = i;
      while (!visited[j]) {
        visited[j] = true;
        j = perm[j];
      }
    }
  }
  return (perm.length - cycles) % 2;
}

// ─── MoYuBluetoothConnection ───────────────────────────────────────────────

export class MoYuBluetoothConnection implements CubeConnection {
  private gatt: BluetoothRemoteGATTServer | null = null;
  private readChar: BluetoothRemoteGATTCharacteristic | null = null;
  private writeChar: BluetoothRemoteGATTCharacteristic | null = null;
  private cipher: MoYuCipher | null = null;
  private kpuzzle: KPuzzle | null = null;
  private currentState: KPattern | null = null;
  private currentStatus: ConnectionStatus = "disconnected";
  private currentBattery: number | null = null;

  // Move counter state
  private moveCnt = -1;
  private prevMoveCnt = -1;

  // Timestamp tracking
  private deviceTime = 0;
  private deviceTimeOffset = 0;

  // Debug counters
  /** Total notifications received from the cube. */
  notificationCount = 0;
  /** Notifications that decrypted to a recognized opcode. */
  parsedCount = 0;
  /** Last raw opcode byte seen after decryption (0 = none yet). */
  lastOpcode = 0;
  /** Write characteristic properties for debugging. */
  writeProps = "";
  /** Whether writes threw an error. */
  writeError = "";

  // Event listeners
  private moveListeners = new Set<(event: CubeMoveEvent) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();
  private batteryListeners = new Set<(level: number) => void>();

  /** Bound handler for characteristic value changes. */
  private readonly onCharValueChanged = (event: Event): void => {
    const target = event.target as BluetoothRemoteGATTCharacteristic;
    if (target.value) {
      void this.handleNotification(target.value);
    }
  };

  /** Bound handler for GATT disconnection. */
  private readonly onDisconnected = (): void => {
    this.setStatus("disconnected");
    this.cleanup();
  };

  constructor(private readonly device: BluetoothDevice) {}

  // ── CubeConnection interface ────────────────────────────────────────────

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  get state(): KPattern | null {
    return this.currentState;
  }

  get battery(): number | null {
    return this.currentBattery;
  }

  async connect(): Promise<void> {
    if (this.currentStatus === "connecting") return;

    this.setStatus("connecting");

    try {
      this.kpuzzle = await cube3x3x3.kpuzzle();
      this.currentState = this.kpuzzle.defaultPattern();

      // Step 1: Resolve MAC address
      const mac = await this.resolveMacAddress();

      this.cipher = await createMoYuCipher(mac);

      // Step 2: Connect GATT
      if (!this.device.gatt) {
        throw new Error("Device has no GATT server");
      }
      this.gatt = await this.device.gatt.connect();

      // Step 3: Get service and characteristics
      const service = await this.gatt.getPrimaryService(SERVICE_UUID);
      const chrcts = await service.getCharacteristics();

      this.readChar =
        chrcts.find((c) => c.uuid.toLowerCase() === CHRT_UUID_READ) ?? null;
      this.writeChar =
        chrcts.find((c) => c.uuid.toLowerCase() === CHRT_UUID_WRITE) ?? null;

      if (!this.readChar || !this.writeChar) {
        const found = chrcts.map((c) => c.uuid).join(", ");
        throw new Error(
          `Required characteristics not found. Expected ${CHRT_UUID_READ} and ${CHRT_UUID_WRITE}. Found: ${found || "none"}`,
        );
      }

      // Step 4: Start notifications
      this.readChar.addEventListener(
        "characteristicvaluechanged",
        this.onCharValueChanged,
      );
      await this.readChar.startNotifications();
      // Small delay to let the BLE stack settle before sending requests
      await new Promise((r) => setTimeout(r, 200));

      // Step 5: Listen for disconnection
      this.device.addEventListener(
        "gattserverdisconnected",
        this.onDisconnected,
      );

      // Log write characteristic properties for debugging
      const p = this.writeChar.properties;
      this.writeProps = [
        p.write && "write",
        p.writeWithoutResponse && "writeWithoutResponse",
        p.notify && "notify",
        p.read && "read",
      ].filter(Boolean).join(",") || "none";

      // Step 6: Request initial state
      try {
        await this.sendRequest(0xa1); // info
        await this.sendRequest(0xa3); // facelets
        await this.sendRequest(0xa4); // battery
      } catch (e) {
        this.writeError = e instanceof Error ? e.message : String(e);
      }

      this.setStatus("connected");
    } catch (error) {
      this.setStatus("disconnected");
      this.cleanup();
      throw error;
    }
  }

  disconnect(): void {
    if (this.gatt?.connected) {
      this.gatt.disconnect();
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

  // ── Internal helpers ────────────────────────────────────────────────────

  /**
   * Try to determine the cube's MAC address:
   * 1. Watch for BLE advertisements (manufacturer data)
   * 2. Parse from device name (WCU_MY32_XXXX pattern)
   * 3. Prompt the user as last resort
   */
  private async resolveMacAddress(): Promise<string> {
    // Try advertisement data first
    const advMac = await this.tryAdvertisementMac().catch(() => null);
    if (advMac) return advMac;

    // Last resort: prompt user (name-based derivation is unreliable — prefix byte varies)
    const mac = prompt(
      "Could not automatically detect cube MAC address.\n" +
        "Enter MAC address (from chrome://bluetooth-internals):\n" +
        "Format: XX:XX:XX:XX:XX:XX",
    );
    if (!mac) {
      throw new Error("MAC address required for MoYu cube connection");
    }
    return mac;
  }

  /**
   * Watch for BLE advertisements to extract MAC from manufacturer data.
   * Returns a promise that resolves with the MAC or rejects after timeout.
   */
  private tryAdvertisementMac(): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Advertisement timeout"));
      }, 5000);

      const cleanup = () => {
        clearTimeout(timeout);
        try {
          this.device.removeEventListener(
            "advertisementreceived",
            onAdv as EventListener,
          );
          // watchAdvertisements may not be available
        } catch {
          // ignore
        }
      };

      const onAdv = (event: BluetoothAdvertisingEvent) => {
        const mfData = event.manufacturerData;
        if (!mfData) return;

        // Try each manufacturer data entry
        for (const [, dataView] of mfData) {
          if (dataView.byteLength >= 6) {
            const mac: string[] = [];
            for (let i = 0; i < 6; i++) {
              mac.push(
                (dataView.getUint8(dataView.byteLength - i - 1) + 0x100)
                  .toString(16)
                  .slice(1),
              );
            }
            cleanup();
            resolve(mac.join(":"));
            return;
          }
        }
      };

      this.device.addEventListener(
        "advertisementreceived",
        onAdv as EventListener,
      );

      // watchAdvertisements() may not be supported in all browsers
      if ("watchAdvertisements" in this.device) {
        (this.device as { watchAdvertisements: () => Promise<void> })
          .watchAdvertisements()
          .catch(() => {
            cleanup();
            reject(new Error("watchAdvertisements failed"));
          });
      } else {
        cleanup();
        reject(new Error("watchAdvertisements not available"));
      }
    });
  }

  /** Send a simple request (opcode only, zero-padded to 20 bytes). */
  private async sendRequest(opcode: number): Promise<void> {
    if (!this.writeChar || !this.cipher) return;

    const req = new Uint8Array(20);
    req[0] = opcode;
    const encrypted = await this.cipher.encrypt(req);
    // Use writeValueWithoutResponse if available, fall back to writeValue
    // (some iOS BLE browsers don't support writeValueWithoutResponse)
    if (this.writeChar.properties.writeWithoutResponse) {
      await this.writeChar.writeValueWithoutResponse(encrypted);
    } else {
      await this.writeChar.writeValue(encrypted);
    }
  }

  /** Handle an incoming notification from the read characteristic. */
  private async handleNotification(value: DataView): Promise<void> {
    if (!this.cipher) return;

    const raw = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    const decrypted = await this.cipher.decrypt(raw);
    this.notificationCount++;
    this.lastOpcode = decrypted[0];
    const msg = parseMessage(decrypted);
    if (!msg) return;
    this.parsedCount++;

    switch (msg.type) {
      case "facelets":
        this.handleFacelets(msg.facelets, msg.moveCount);
        break;
      case "battery":
        this.handleBattery(msg.level);
        break;
      case "moves":
        this.handleMoves(msg.moveCount, msg.moves);
        break;
      case "info":
        // Info messages are logged but not acted upon
        break;
    }
  }

  /** Process initial facelet state from the cube. */
  private handleFacelets(facelets: string, moveCount: number): void {
    if (this.prevMoveCnt !== -1) return; // Only use initial state

    this.moveCnt = moveCount;
    this.prevMoveCnt = moveCount;

    try {
      if (this.kpuzzle) {
        this.currentState = faceletToKPattern(facelets, this.kpuzzle);
      }
    } catch {
      // If facelet parsing fails, fall back to solved state
      if (this.kpuzzle) {
        this.currentState = this.kpuzzle.defaultPattern();
      }
    }
  }

  /** Process battery level update. */
  private handleBattery(level: number): void {
    this.currentBattery = level;
    for (const listener of this.batteryListeners) {
      listener(level);
    }
  }

  /** Process move events from the cube. */
  private handleMoves(moveCount: number, moves: MoYuBufferedMove[]): void {
    this.moveCnt = moveCount;
    if (this.moveCnt === this.prevMoveCnt || this.prevMoveCnt === -1) return;

    const locTime = Date.now();
    let moveDiff = (this.moveCnt - this.prevMoveCnt) & 0xff;

    if (moveDiff > 5) {
      // Too many missed moves — request full state resync
      this.prevMoveCnt = this.moveCnt;
      void this.sendRequest(0xa3);
      // Reset prevMoveCnt so the facelet handler will process the response
      this.prevMoveCnt = -1;
      return;
    }

    this.prevMoveCnt = this.moveCnt;

    if (moveDiff > moves.length) {
      moveDiff = moves.length;
    }

    // Time correction: calculate expected time and adjust offset if drift > 2s
    let calcTs = this.deviceTime + this.deviceTimeOffset;
    for (let i = moveDiff - 1; i >= 0; i--) {
      calcTs += moves[i].timeOffset;
    }
    if (!this.deviceTime || Math.abs(locTime - calcTs) > 2000) {
      this.deviceTime += locTime - calcTs;
    }

    // Apply moves in chronological order (oldest first = highest index)
    for (let i = moveDiff - 1; i >= 0; i--) {
      const m = moves[i];
      const moveStr = m.direction === "CCW" ? `${m.face}'` : m.face;
      const move = new Move(moveStr);

      this.deviceTime += m.timeOffset;

      if (this.currentState) {
        this.currentState = this.currentState.applyMove(move);

        const event: CubeMoveEvent = {
          move,
          timestamp: this.deviceTime,
          state: this.currentState,
        };

        for (const listener of this.moveListeners) {
          listener(event);
        }
      }
    }

    this.deviceTimeOffset = locTime - this.deviceTime;
  }

  private setStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }

  private cleanup(): void {
    if (this.readChar) {
      this.readChar.removeEventListener(
        "characteristicvaluechanged",
        this.onCharValueChanged,
      );
      void this.readChar.stopNotifications().catch(() => {});
      this.readChar = null;
    }
    this.writeChar = null;
    this.gatt = null;
    this.cipher = null;

    this.device.removeEventListener(
      "gattserverdisconnected",
      this.onDisconnected,
    );

    // Reset move tracking state
    this.moveCnt = -1;
    this.prevMoveCnt = -1;
    this.deviceTime = 0;
    this.deviceTimeOffset = 0;
  }
}
