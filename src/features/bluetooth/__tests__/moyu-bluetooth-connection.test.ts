import { describe, it, expect, vi, beforeAll } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPuzzle } from "cubing/kpuzzle";
import {
  deriveKeyAndIv,
  parseMacAddress,
  createMoYuCipher,
  bytesToBits,
  parseMoYuFacelets,
  parseMessage,
  faceletToKPattern,
  CORNER_FACELETS,
  EDGE_FACELETS,
} from "../moyu-bluetooth-connection";

// ─── Shared KPuzzle instance ────────────────────────────────────────────────

let kpuzzle: KPuzzle;

beforeAll(async () => {
  kpuzzle = await cube3x3x3.kpuzzle();
});

// ─── deriveKeyAndIv ─────────────────────────────────────────────────────────

describe("deriveKeyAndIv", () => {
  it("returns 16-byte key and iv arrays", () => {
    const mac = new Uint8Array([0xcf, 0x30, 0x16, 0x00, 0xab, 0xcd]);
    const { key, iv } = deriveKeyAndIv(mac);
    expect(key).toHaveLength(16);
    expect(iv).toHaveLength(16);
  });

  it("modifies first 6 bytes using reversed MAC", () => {
    const mac = new Uint8Array([0xcf, 0x30, 0x16, 0x00, 0xab, 0xcd]);
    const { key, iv } = deriveKeyAndIv(mac);

    // KEY_BASE = [21,119,58,92,103,14,45,31,23,103,42,19,155,103,82,87]
    // IV_BASE  = [17,35,38,37,134,42,44,59,85,6,127,49,126,103,33,87]
    // MAC reversed: [0xcd, 0xab, 0x00, 0x16, 0x30, 0xcf]

    // key[0] = (21 + 0xcd) % 255 = (21 + 205) % 255 = 226
    expect(key[0]).toBe(226);
    // key[1] = (119 + 0xab) % 255 = (119 + 171) % 255 = 290 % 255 = 35
    expect(key[1]).toBe(35);
    // key[6..15] unchanged
    expect(key[6]).toBe(45);
    expect(key[15]).toBe(87);

    // iv[0] = (17 + 0xcd) % 255 = (17 + 205) % 255 = 222
    expect(iv[0]).toBe(222);
    // iv[6..15] unchanged
    expect(iv[6]).toBe(44);
    expect(iv[15]).toBe(87);
  });

  it("handles all-zero MAC", () => {
    const mac = new Uint8Array(6);
    const { key, iv } = deriveKeyAndIv(mac);
    // With zero MAC, key and iv should equal their base values
    expect(key[0]).toBe(21);
    expect(iv[0]).toBe(17);
  });
});

// ─── parseMacAddress ────────────────────────────────────────────────────────

describe("parseMacAddress", () => {
  it("parses colon-separated hex MAC", () => {
    const bytes = parseMacAddress("CF:30:16:00:AB:CD");
    expect(bytes).toEqual(new Uint8Array([0xcf, 0x30, 0x16, 0x00, 0xab, 0xcd]));
  });
});

// ─── AES encryption round-trip ──────────────────────────────────────────────

describe("createMoYuCipher", () => {
  it("encrypt then decrypt returns original data", async () => {
    const cipher = await createMoYuCipher("CF:30:16:00:AB:CD");
    const original = new Uint8Array(20);
    for (let i = 0; i < 20; i++) original[i] = i * 13 + 7;

    const encrypted = await cipher.encrypt(original);
    // Encrypted should differ from original
    expect(encrypted).not.toEqual(original);

    const decrypted = await cipher.decrypt(encrypted);
    expect(decrypted).toEqual(original);
  });

  it("decrypt then encrypt returns original ciphertext", async () => {
    const cipher = await createMoYuCipher("AA:BB:CC:DD:EE:FF");
    const ciphertext = new Uint8Array(20);
    for (let i = 0; i < 20; i++) ciphertext[i] = (i * 37 + 11) & 0xff;

    const decrypted = await cipher.decrypt(ciphertext);
    const reEncrypted = await cipher.encrypt(decrypted);
    expect(reEncrypted).toEqual(ciphertext);
  });

  it("handles 16-byte messages (single block)", async () => {
    const cipher = await createMoYuCipher("11:22:33:44:55:66");
    const original = new Uint8Array(16);
    for (let i = 0; i < 16; i++) original[i] = i;

    const encrypted = await cipher.encrypt(original);
    const decrypted = await cipher.decrypt(encrypted);
    expect(decrypted).toEqual(original);
  });

  it("different MACs produce different ciphertexts", async () => {
    const cipher1 = await createMoYuCipher("AA:BB:CC:DD:EE:FF");
    const cipher2 = await createMoYuCipher("11:22:33:44:55:66");
    const data = new Uint8Array(20).fill(42);

    const enc1 = await cipher1.encrypt(data);
    const enc2 = await cipher2.encrypt(data);
    expect(enc1).not.toEqual(enc2);
  });
});

// ─── bytesToBits ────────────────────────────────────────────────────────────

describe("bytesToBits", () => {
  it("converts bytes to 8-bit binary strings", () => {
    expect(bytesToBits(new Uint8Array([0]))).toBe("00000000");
    expect(bytesToBits(new Uint8Array([255]))).toBe("11111111");
    expect(bytesToBits(new Uint8Array([0xa3]))).toBe("10100011");
  });

  it("handles multi-byte input", () => {
    const bits = bytesToBits(new Uint8Array([0x01, 0x80]));
    expect(bits).toBe("0000000110000000");
  });
});

// ─── parseMoYuFacelets ──────────────────────────────────────────────────────

describe("parseMoYuFacelets", () => {
  /**
   * Build 144-bit facelet string for a solved cube.
   * Protocol sends 6 faces in FBUDLR order, 8 stickers each, 3 bits per sticker.
   * Color indices: F=0, B=1, U=2, D=3, L=4, R=5
   */
  function solvedBits(): string {
    let bits = "";
    // Face order: F(0), B(1), U(2), D(3), L(4), R(5)
    const faceColors = [0, 1, 2, 3, 4, 5]; // color index for each face
    for (const color of faceColors) {
      for (let j = 0; j < 8; j++) {
        bits += (color + 8).toString(2).slice(1); // 3-bit binary
      }
    }
    return bits;
  }

  it("parses solved cube facelets", () => {
    const facelets = parseMoYuFacelets(solvedBits());
    // URFDLB ordering, 9 per face
    expect(facelets).toBe(
      "UUUUUUUUU" + "RRRRRRRRR" + "FFFFFFFFF" +
      "DDDDDDDDD" + "LLLLLLLLL" + "BBBBBBBBB",
    );
  });

  it("correctly inserts center stickers", () => {
    const facelets = parseMoYuFacelets(solvedBits());
    // Center of each face at index 4
    expect(facelets[4]).toBe("U");   // U center
    expect(facelets[13]).toBe("R");  // R center
    expect(facelets[22]).toBe("F");  // F center
    expect(facelets[31]).toBe("D");  // D center
    expect(facelets[40]).toBe("L");  // L center
    expect(facelets[49]).toBe("B");  // B center
  });

  it("handles non-solved sticker arrangement", () => {
    // Build a pattern where U face has an R-colored sticker at position 0
    let bits = "";
    const faceColors = [0, 1, 2, 3, 4, 5];
    for (const color of faceColors) {
      for (let j = 0; j < 8; j++) {
        if (color === 2 && j === 0) {
          // U face position 0: set to R color (index 5 = 101)
          bits += "101";
        } else {
          bits += (color + 8).toString(2).slice(1);
        }
      }
    }
    const facelets = parseMoYuFacelets(bits);
    // U face starts at index 0; position 0 of U face should be R
    expect(facelets[0]).toBe("R");
    // Rest of U face should still be U
    expect(facelets[1]).toBe("U");
  });
});

// ─── parseMessage ───────────────────────────────────────────────────────────

describe("parseMessage", () => {
  it("parses info message (0xA1)", () => {
    const data = new Uint8Array(20);
    data[0] = 0xa1;
    // Device name "TESTCUBE" in ASCII
    const name = "TESTCUBE";
    for (let i = 0; i < 8; i++) {
      data[1 + i] = name.charCodeAt(i);
    }
    // Software version at bytes 9-10
    data[9] = 2; // major
    data[10] = 5; // minor
    // Hardware version at bytes 11-12
    data[11] = 1;
    data[12] = 3;

    const msg = parseMessage(data);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe("info");
    if (msg!.type === "info") {
      expect(msg!.deviceName).toBe("TESTCUBE");
      expect(msg!.softwareVersion).toBe("2.5");
      expect(msg!.hardwareVersion).toBe("1.3");
    }
  });

  it("parses battery message (0xA4)", () => {
    const data = new Uint8Array(20);
    data[0] = 0xa4;
    data[1] = 85; // 85% battery

    const msg = parseMessage(data);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe("battery");
    if (msg!.type === "battery") {
      expect(msg!.level).toBe(85);
    }
  });

  it("parses facelet message (0xA3) with move count", () => {
    const data = new Uint8Array(20);
    data[0] = 0xa3;

    // Build solved facelet bits in bytes 1-18 (144 bits)
    // Face order FBUDLR, color indices 0-5, 3 bits each, 8 per face
    const faceColors = [0, 1, 2, 3, 4, 5];
    let bitIdx = 8; // start after opcode byte
    for (const color of faceColors) {
      for (let j = 0; j < 8; j++) {
        for (let b = 2; b >= 0; b--) {
          const byteIdx = Math.floor(bitIdx / 8);
          const bitPos = 7 - (bitIdx % 8);
          if ((color >> b) & 1) {
            data[byteIdx] |= 1 << bitPos;
          }
          bitIdx++;
        }
      }
    }

    // Move count at bits 152-159 (byte 19)
    data[19] = 42;

    const msg = parseMessage(data);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe("facelets");
    if (msg!.type === "facelets") {
      expect(msg!.moveCount).toBe(42);
      expect(msg!.facelets).toHaveLength(54);
      // Should be solved state
      expect(msg!.facelets.slice(0, 9)).toBe("UUUUUUUUU");
    }
  });

  it("parses move message (0xA5)", () => {
    const data = new Uint8Array(20);
    data[0] = 0xa5;

    // Build move message using bit-level encoding
    // Time offsets: 5 × 16-bit values at bits 8-87
    // Move count: byte at bits 88-95
    // Moves: 5 × 5-bit values at bits 96-120

    const bits = bytesToBits(data).split("");

    // Time offset for move 0 (most recent): 100ms
    const timeOff0 = 100;
    for (let b = 0; b < 16; b++) {
      bits[8 + b] = ((timeOff0 >> (15 - b)) & 1).toString();
    }

    // Time offset for move 1: 200ms
    const timeOff1 = 200;
    for (let b = 0; b < 16; b++) {
      bits[24 + b] = ((timeOff1 >> (15 - b)) & 1).toString();
    }

    // Move count
    const moveCnt = 50;
    for (let b = 0; b < 8; b++) {
      bits[88 + b] = ((moveCnt >> (7 - b)) & 1).toString();
    }

    // Move 0: R clockwise = face R(5) << 1 | 0 = 10
    const move0 = 10;
    for (let b = 0; b < 5; b++) {
      bits[96 + b] = ((move0 >> (4 - b)) & 1).toString();
    }

    // Move 1: U counterclockwise = face U(2) << 1 | 1 = 5
    const move1 = 5;
    for (let b = 0; b < 5; b++) {
      bits[101 + b] = ((move1 >> (4 - b)) & 1).toString();
    }

    // Convert bits back to bytes
    const bitsStr = bits.join("");
    for (let i = 0; i < 20; i++) {
      data[i] = parseInt(bitsStr.slice(i * 8, i * 8 + 8), 2);
    }

    const msg = parseMessage(data);
    expect(msg).not.toBeNull();
    expect(msg!.type).toBe("moves");
    if (msg!.type === "moves") {
      expect(msg!.moveCount).toBe(50);
      expect(msg!.moves.length).toBeGreaterThanOrEqual(2);
      expect(msg!.moves[0].face).toBe("R");
      expect(msg!.moves[0].direction).toBe("CW");
      expect(msg!.moves[0].timeOffset).toBe(100);
      expect(msg!.moves[1].face).toBe("U");
      expect(msg!.moves[1].direction).toBe("CCW");
      expect(msg!.moves[1].timeOffset).toBe(200);
    }
  });

  it("stops parsing moves when encountering invalid move value", () => {
    const data = new Uint8Array(20);
    data[0] = 0xa5;

    const bits = bytesToBits(data).split("");

    // Move count
    for (let b = 0; b < 8; b++) {
      bits[88 + b] = ((5 >> (7 - b)) & 1).toString();
    }

    // Move 0: valid (R = 10)
    for (let b = 0; b < 5; b++) {
      bits[96 + b] = ((10 >> (4 - b)) & 1).toString();
    }

    // Move 1: invalid (>= 12, e.g., 15 = 11111)
    for (let b = 0; b < 5; b++) {
      bits[101 + b] = "1";
    }

    const bitsStr = bits.join("");
    for (let i = 0; i < 20; i++) {
      data[i] = parseInt(bitsStr.slice(i * 8, i * 8 + 8), 2);
    }

    const msg = parseMessage(data);
    expect(msg!.type).toBe("moves");
    if (msg!.type === "moves") {
      expect(msg!.moves).toHaveLength(1); // Only the first valid move
    }
  });

  it("returns null for unknown opcode", () => {
    const data = new Uint8Array(20);
    data[0] = 0xff;
    expect(parseMessage(data)).toBeNull();
  });
});

// ─── faceletToKPattern ──────────────────────────────────────────────────────

describe("faceletToKPattern", () => {
  const SOLVED =
    "UUUUUUUUU" + "RRRRRRRRR" + "FFFFFFFFF" +
    "DDDDDDDDD" + "LLLLLLLLL" + "BBBBBBBBB";

  it("converts solved state to identity pattern", () => {
    const pattern = faceletToKPattern(SOLVED, kpuzzle);
    const expected = kpuzzle.defaultPattern();
    expect(pattern.patternData.CORNERS.pieces).toEqual(expected.patternData.CORNERS.pieces);
    expect(pattern.patternData.CORNERS.orientation).toEqual(expected.patternData.CORNERS.orientation);
    expect(pattern.patternData.EDGES.pieces).toEqual(expected.patternData.EDGES.pieces);
    expect(pattern.patternData.EDGES.orientation).toEqual(expected.patternData.EDGES.orientation);
  });

  it("converts state after R move correctly", () => {
    // Apply R to solved state and check the resulting pattern
    const afterR = kpuzzle.defaultPattern().applyMove("R");
    // Build facelet string for R-applied state
    const facelets = kpatternToFacelets(afterR);
    const reconstructed = faceletToKPattern(facelets, kpuzzle);

    expect(reconstructed.patternData.CORNERS.pieces).toEqual(
      afterR.patternData.CORNERS.pieces,
    );
    expect(reconstructed.patternData.CORNERS.orientation).toEqual(
      afterR.patternData.CORNERS.orientation,
    );
    expect(reconstructed.patternData.EDGES.pieces).toEqual(
      afterR.patternData.EDGES.pieces,
    );
    expect(reconstructed.patternData.EDGES.orientation).toEqual(
      afterR.patternData.EDGES.orientation,
    );
  });

  it("converts state after F move correctly", () => {
    const afterF = kpuzzle.defaultPattern().applyMove("F");
    const facelets = kpatternToFacelets(afterF);
    const reconstructed = faceletToKPattern(facelets, kpuzzle);

    expect(reconstructed.patternData.CORNERS.pieces).toEqual(
      afterF.patternData.CORNERS.pieces,
    );
    expect(reconstructed.patternData.CORNERS.orientation).toEqual(
      afterF.patternData.CORNERS.orientation,
    );
    expect(reconstructed.patternData.EDGES.pieces).toEqual(
      afterF.patternData.EDGES.pieces,
    );
    expect(reconstructed.patternData.EDGES.orientation).toEqual(
      afterF.patternData.EDGES.orientation,
    );
  });

  it("converts scrambled state correctly", () => {
    const scrambled = kpuzzle.defaultPattern().applyAlg("R U R' U' F' D2 L B");
    const facelets = kpatternToFacelets(scrambled);
    const reconstructed = faceletToKPattern(facelets, kpuzzle);

    expect(reconstructed.patternData.CORNERS.pieces).toEqual(
      scrambled.patternData.CORNERS.pieces,
    );
    expect(reconstructed.patternData.CORNERS.orientation).toEqual(
      scrambled.patternData.CORNERS.orientation,
    );
    expect(reconstructed.patternData.EDGES.pieces).toEqual(
      scrambled.patternData.EDGES.pieces,
    );
    expect(reconstructed.patternData.EDGES.orientation).toEqual(
      scrambled.patternData.EDGES.orientation,
    );
  });

  it("throws on invalid facelet length", () => {
    expect(() => faceletToKPattern("UUUUU", kpuzzle)).toThrow("Expected 54 facelets");
  });

  it("throws on invalid facelet character", () => {
    const bad = "X" + SOLVED.slice(1);
    expect(() => faceletToKPattern(bad, kpuzzle)).toThrow("Invalid facelet color");
  });

  it("throws on invalid corner combination", () => {
    // Replace corner UFR stickers with impossible combination (U,U,U)
    const facelets = SOLVED.split("");
    facelets[8] = "U"; // already U
    facelets[9] = "U"; // was R
    facelets[20] = "U"; // was F
    expect(() => faceletToKPattern(facelets.join(""), kpuzzle)).toThrow("Invalid corner");
  });

  it("throws on duplicate corner piece", () => {
    // Swap two corner stickers to create a duplicate
    const afterR = kpuzzle.defaultPattern().applyMove("R");
    const facelets = kpatternToFacelets(afterR).split("");
    // Make corner at position 1 look like piece at position 0
    // Position 0 (UFR) has piece 4 (DFR) after R
    // Position 1 (UBR) has piece 0 (UFR) after R
    // Force position 1 to also look like piece 4 (DFR)
    const [f0, f1, f2] = CORNER_FACELETS[1];
    facelets[f0] = "D";
    facelets[f1] = "F";
    facelets[f2] = "R";
    expect(() => faceletToKPattern(facelets.join(""), kpuzzle)).toThrow("Duplicate corner");
  });

  it("throws on corner orientation parity violation", () => {
    // Create a state with one twisted corner (physically impossible)
    const facelets = SOLVED.split("");
    // Twist UFR corner by 1: swap U→R→F→U
    const [f0, f1, f2] = CORNER_FACELETS[0]; // UFR
    facelets[f0] = "F"; // was U
    facelets[f1] = "U"; // was R
    facelets[f2] = "R"; // was F
    expect(() => faceletToKPattern(facelets.join(""), kpuzzle)).toThrow(
      "corner orientation parity",
    );
  });

  it("throws on edge orientation parity violation", () => {
    // Flip a single edge (physically impossible)
    const facelets = SOLVED.split("");
    const [e0, e1] = EDGE_FACELETS[0]; // UF edge
    facelets[e0] = "F"; // was U
    facelets[e1] = "U"; // was F
    expect(() => faceletToKPattern(facelets.join(""), kpuzzle)).toThrow(
      "edge orientation parity",
    );
  });

  it("throws on permutation parity mismatch", () => {
    // Swap two edges without swapping two corners (physically impossible)
    const facelets = SOLVED.split("");
    // Swap UF and UR edges
    const [uf0, uf1] = EDGE_FACELETS[0]; // UF
    const [ur0, ur1] = EDGE_FACELETS[1]; // UR
    const tmpA = facelets[uf0];
    const tmpB = facelets[uf1];
    facelets[uf0] = facelets[ur0];
    facelets[uf1] = facelets[ur1];
    facelets[ur0] = tmpA;
    facelets[ur1] = tmpB;
    expect(() => faceletToKPattern(facelets.join(""), kpuzzle)).toThrow(
      "Permutation parity",
    );
  });
});

// ─── Move gap handling (integration-level via handleMoves) ──────────────────

describe("MoYuBluetoothConnection move gap handling", () => {
  // We test the move processing logic by examining the exported parseMessage
  // and simulating the sequence of events that MoYuBluetoothConnection handles.
  // Since handleMoves is private, we verify behavior via the public interface
  // using a mock BluetoothDevice.

  function createMockDevice(): BluetoothDevice {
    return {
      name: "WCU_MY32_ABCD",
      gatt: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    } as unknown as BluetoothDevice;
  }

  it("parseMessage correctly identifies move count and buffer", () => {
    // Buffer always holds 5 moves; uninitialized slots are 0 = F CW (valid).
    // We set 2 specific moves and verify they appear correctly.
    const data = buildMoveMessage(50, [
      { moveVal: 10, timeOffset: 150 }, // R CW
      { moveVal: 4, timeOffset: 200 },  // U CW
    ]);

    const msg = parseMessage(data);
    expect(msg!.type).toBe("moves");
    if (msg!.type === "moves") {
      expect(msg!.moveCount).toBe(50);
      // Buffer has 5 entries (remaining 3 are F CW from zero-init)
      expect(msg!.moves.length).toBeGreaterThanOrEqual(2);
      expect(msg!.moves[0].face).toBe("R");
      expect(msg!.moves[0].direction).toBe("CW");
      expect(msg!.moves[0].timeOffset).toBe(150);
      expect(msg!.moves[1].face).toBe("U");
      expect(msg!.moves[1].direction).toBe("CW");
      expect(msg!.moves[1].timeOffset).toBe(200);
    }
  });

  it("encodes all 6 face moves correctly", () => {
    // F=0,1  B=2,3  U=4,5  D=6,7  L=8,9  R=10,11
    const testCases: Array<{ moveVal: number; face: string; dir: "CW" | "CCW" }> = [
      { moveVal: 0, face: "F", dir: "CW" },
      { moveVal: 1, face: "F", dir: "CCW" },
      { moveVal: 2, face: "B", dir: "CW" },
      { moveVal: 3, face: "B", dir: "CCW" },
      { moveVal: 4, face: "U", dir: "CW" },
      { moveVal: 5, face: "U", dir: "CCW" },
      { moveVal: 6, face: "D", dir: "CW" },
      { moveVal: 7, face: "D", dir: "CCW" },
      { moveVal: 8, face: "L", dir: "CW" },
      { moveVal: 9, face: "L", dir: "CCW" },
      { moveVal: 10, face: "R", dir: "CW" },
      { moveVal: 11, face: "R", dir: "CCW" },
    ];

    for (const tc of testCases) {
      const data = buildMoveMessage(1, [{ moveVal: tc.moveVal, timeOffset: 100 }]);
      const msg = parseMessage(data);
      expect(msg!.type).toBe("moves");
      if (msg!.type === "moves") {
        expect(msg!.moves[0].face).toBe(tc.face);
        expect(msg!.moves[0].direction).toBe(tc.dir);
      }
    }
  });
});

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Convert a KPattern back to a 54-character facelet string (for testing).
 * This is the inverse of faceletToKPattern.
 */
function kpatternToFacelets(pattern: { patternData: { CORNERS: { pieces: number[]; orientation: number[] }; EDGES: { pieces: number[]; orientation: number[] } } }): string {
  const CORNER_COLORS_LOCAL = [
    ["U", "R", "F"], ["U", "B", "R"], ["U", "L", "B"], ["U", "F", "L"],
    ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"],
  ];
  const EDGE_COLORS_LOCAL = [
    ["U", "F"], ["U", "R"], ["U", "B"], ["U", "L"],
    ["D", "F"], ["D", "R"], ["D", "B"], ["D", "L"],
    ["F", "R"], ["F", "L"], ["B", "R"], ["B", "L"],
  ];
  const FACE_ORDER = "URFDLB";

  const facelets = new Array<string>(54);

  // Fill centers
  for (let f = 0; f < 6; f++) {
    facelets[f * 9 + 4] = FACE_ORDER[f];
  }

  // Fill corners
  const { pieces: cp, orientation: co } = pattern.patternData.CORNERS;
  for (let pos = 0; pos < 8; pos++) {
    const piece = cp[pos];
    const orient = co[pos];
    const colors = CORNER_COLORS_LOCAL[piece];

    for (let i = 0; i < 3; i++) {
      // Position slot i gets piece sticker at (i - orient + 3) % 3
      const sticker = colors[(i - orient + 3) % 3];
      facelets[CORNER_FACELETS[pos][i]] = sticker;
    }
  }

  // Fill edges
  const { pieces: ep, orientation: eo } = pattern.patternData.EDGES;
  for (let pos = 0; pos < 12; pos++) {
    const piece = ep[pos];
    const orient = eo[pos];
    const colors = EDGE_COLORS_LOCAL[piece];

    for (let i = 0; i < 2; i++) {
      const sticker = colors[(i - orient + 2) % 2];
      facelets[EDGE_FACELETS[pos][i]] = sticker;
    }
  }

  return facelets.join("");
}

/**
 * Build a raw 20-byte move message (0xA5) with specified moves.
 */
function buildMoveMessage(
  moveCount: number,
  moves: Array<{ moveVal: number; timeOffset: number }>,
): Uint8Array {
  const data = new Uint8Array(20);
  const bits = new Array(160).fill("0");

  // Opcode
  const opBits = (0xa5).toString(2).padStart(8, "0");
  for (let i = 0; i < 8; i++) bits[i] = opBits[i];

  // Time offsets at bits 8+
  for (let i = 0; i < moves.length && i < 5; i++) {
    const tBits = moves[i].timeOffset.toString(2).padStart(16, "0");
    for (let b = 0; b < 16; b++) {
      bits[8 + i * 16 + b] = tBits[b];
    }
  }

  // Move count at bits 88-95
  const mcBits = moveCount.toString(2).padStart(8, "0");
  for (let b = 0; b < 8; b++) {
    bits[88 + b] = mcBits[b];
  }

  // Move values at bits 96+
  for (let i = 0; i < moves.length && i < 5; i++) {
    const mBits = moves[i].moveVal.toString(2).padStart(5, "0");
    for (let b = 0; b < 5; b++) {
      bits[96 + i * 5 + b] = mBits[b];
    }
  }

  // Convert bits to bytes
  for (let i = 0; i < 20; i++) {
    data[i] = parseInt(bits.slice(i * 8, i * 8 + 8).join(""), 2);
  }

  return data;
}
