import { Alg } from "cubing/alg";
import type { KPuzzle } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { PLL_CASES } from "./pll-cases";

/**
 * Color represents which face a sticker belongs to.
 * Only U-layer side faces are used (PLL doesn't expose D stickers).
 */
export type Color = "U" | "F" | "R" | "B" | "L";

/**
 * The 12 side stickers around the U layer, grouped by face.
 * Each face shows [left-corner, edge, right-corner] reading left-to-right
 * as seen looking at that face from outside the cube.
 */
export interface OverheadStickers {
  front: [Color, Color, Color];
  right: [Color, Color, Color];
  back: [Color, Color, Color];
  left: [Color, Color, Color];
}

/** Viewing corner index: 0=UFR, 1=URB, 2=UBL, 3=ULF */
export type ViewingCorner = 0 | 1 | 2 | 3;

/** Pre-AUF adjustment applied after inverse algorithm */
export type AUF = "" | "U" | "U'" | "U2";

/** Side faces in CW order (viewed from above): F, R, B, L */
const SIDE_FACES: Color[] = ["F", "R", "B", "L"];

/**
 * Viewing corner -> [left face index, right face index] in SIDE_FACES.
 * Left/right as seen from outside looking at that corner.
 */
const CORNER_FACE_INDICES: [number, number][] = [
  [0, 1], // UFR: sees F (left) and R (right)
  [1, 2], // URB: sees R (left) and B (right)
  [2, 3], // UBL: sees B (left) and L (right)
  [3, 0], // ULF: sees L (left) and F (right)
];

/**
 * Lazily generates and caches sticker color data for all 21 PLL cases,
 * 4 AUFs, and 4 viewing corners. Uses cubing.js to compute the actual
 * cube state after applying the inverse of each PLL algorithm.
 */
export class PllStickerCache {
  private kpuzzle: KPuzzle | null = null;

  // U-layer positions in CW order (cubing.js internal indices)
  private uEdgePositions: number[] = [];   // [UF, UR, UB, UL]
  private uCornerPositions: number[] = []; // [UFR, UBR, UBL, UFL]

  // Home color mappings (piece index -> face color(s))
  private edgeHomeColor = new Map<number, Color>();
  private cornerHomeCW = new Map<number, [Color, Color]>();

  // Caches
  private stickerCache = new Map<string, Color[]>();
  private overheadCache = new Map<string, OverheadStickers>();

  /**
   * Lazily initialize by discovering U-layer geometry from cubing.js.
   * Determines piece positions and their face mappings empirically
   * by applying known moves and observing which positions change.
   */
  private async init(): Promise<void> {
    if (this.kpuzzle) return;

    this.kpuzzle = await cube3x3x3.kpuzzle();
    const solved = this.kpuzzle.defaultPattern();

    // --- Find U-layer positions via U move ---
    const afterU = solved.applyMove("U");
    const rawEdges: number[] = [];
    for (let i = 0; i < 12; i++) {
      if (afterU.patternData["EDGES"].pieces[i] !== i) rawEdges.push(i);
    }
    const rawCorners: number[] = [];
    for (let i = 0; i < 8; i++) {
      if (afterU.patternData["CORNERS"].pieces[i] !== i) rawCorners.push(i);
    }

    // --- Determine CW cycle order ---
    const edgeCW = this.findCWCycle(
      rawEdges,
      afterU.patternData["EDGES"].pieces,
    );
    const cornerCW = this.findCWCycle(
      rawCorners,
      afterU.patternData["CORNERS"].pieces,
    );

    // --- Identify UF edge via F move ---
    const afterF = solved.applyMove("F");
    const ufEdge = rawEdges.find(
      (p) => afterF.patternData["EDGES"].pieces[p] !== p,
    )!;

    // --- Identify UFR corner via F+R move intersection ---
    const afterR = solved.applyMove("R");
    const fCorners = rawCorners.filter(
      (p) => afterF.patternData["CORNERS"].pieces[p] !== p,
    );
    const rCorners = rawCorners.filter(
      (p) => afterR.patternData["CORNERS"].pieces[p] !== p,
    );
    const ufrCorner = fCorners.find((p) => rCorners.includes(p))!;

    // --- Align cycles to start from UF / UFR ---
    const ufIdx = edgeCW.indexOf(ufEdge);
    this.uEdgePositions = [
      ...edgeCW.slice(ufIdx),
      ...edgeCW.slice(0, ufIdx),
    ];

    const ufrIdx = cornerCW.indexOf(ufrCorner);
    this.uCornerPositions = [
      ...cornerCW.slice(ufrIdx),
      ...cornerCW.slice(0, ufrIdx),
    ];

    // --- Build home color maps ---
    // Edge piece at position i borders SIDE_FACES[i]
    // Corner piece at position i borders [SIDE_FACES[i], SIDE_FACES[(i+1)%4]] in CW order
    for (let i = 0; i < 4; i++) {
      const edgePos = this.uEdgePositions[i];
      this.edgeHomeColor.set(edgePos, SIDE_FACES[i]);

      const cornerPos = this.uCornerPositions[i];
      this.cornerHomeCW.set(cornerPos, [
        SIDE_FACES[i],
        SIDE_FACES[(i + 1) % 4],
      ]);
    }
  }

  /**
   * Trace the cycle of U-layer positions after a U move, following
   * the source chain: for each position, find where its piece came from.
   * This produces the order matching SIDE_FACES = [F, R, B, L].
   */
  private findCWCycle(
    positions: number[],
    piecesAfterU: ArrayLike<number>,
  ): number[] {
    const cycle: number[] = [positions[0]];
    let current = positions[0];
    for (let step = 0; step < 3; step++) {
      // The piece at position 'current' came from position piecesAfterU[current]
      const next = piecesAfterU[current] as number;
      cycle.push(next);
      current = next;
    }
    return cycle;
  }

  /**
   * Get the 6 side stickers visible from a viewing corner.
   * Returns [leftFace0, leftFace1, leftFace2, rightFace0, rightFace1, rightFace2],
   * each face reading left-to-right as seen from outside looking at that corner.
   */
  async getStickers(
    caseName: string,
    auf: AUF,
    corner: ViewingCorner,
  ): Promise<Color[]> {
    const key = `${caseName}:${auf}:${corner}`;
    const cached = this.stickerCache.get(key);
    if (cached) return cached;

    const overhead = await this.getOverheadStickers(caseName, auf);
    const [leftIdx, rightIdx] = CORNER_FACE_INDICES[corner];
    const leftFace = getFaceByIndex(overhead, leftIdx);
    const rightFace = getFaceByIndex(overhead, rightIdx);
    const result: Color[] = [...leftFace, ...rightFace];

    this.stickerCache.set(key, result);
    return result;
  }

  /**
   * Get all 12 side stickers around the U layer as an overhead view.
   * Each face shows [left-corner, edge, right-corner] reading left-to-right.
   */
  async getOverheadStickers(
    caseName: string,
    auf: AUF,
  ): Promise<OverheadStickers> {
    const key = `${caseName}:${auf}`;
    const cached = this.overheadCache.get(key);
    if (cached) return cached;

    await this.init();

    const caseData = PLL_CASES[caseName];
    const inverseAlg = new Alg(caseData.algorithm).invert().toString();
    const fullAlg = auf ? `${inverseAlg} ${auf}` : inverseAlg;

    const solved = this.kpuzzle!.defaultPattern();
    const state = solved.applyAlg(fullAlg);
    const edges = state.patternData["EDGES"];
    const corners = state.patternData["CORNERS"];

    const faces: [Color, Color, Color][] = [];

    for (let f = 0; f < 4; f++) {
      // Left corner: position (f+3)%4, using CW-second sticker
      // (the sticker that faces this face from the CCW-adjacent corner)
      const leftCornerPos = this.uCornerPositions[(f + 3) % 4];
      const leftCornerPiece = corners.pieces[leftCornerPos];
      const leftColor = this.cornerHomeCW.get(leftCornerPiece)![1];

      // Center edge: position f
      const edgePos = this.uEdgePositions[f];
      const edgePiece = edges.pieces[edgePos];
      const centerColor = this.edgeHomeColor.get(edgePiece)!;

      // Right corner: position f, using CW-first sticker
      // (the sticker that faces this face from the CW-adjacent corner)
      const rightCornerPos = this.uCornerPositions[f];
      const rightCornerPiece = corners.pieces[rightCornerPos];
      const rightColor = this.cornerHomeCW.get(rightCornerPiece)![0];

      faces.push([leftColor, centerColor, rightColor]);
    }

    const result: OverheadStickers = {
      front: faces[0],
      right: faces[1],
      back: faces[2],
      left: faces[3],
    };

    this.overheadCache.set(key, result);
    return result;
  }
}

function getFaceByIndex(
  overhead: OverheadStickers,
  faceIdx: number,
): [Color, Color, Color] {
  switch (faceIdx) {
    case 0:
      return overhead.front;
    case 1:
      return overhead.right;
    case 2:
      return overhead.back;
    case 3:
      return overhead.left;
    default:
      throw new Error(`Invalid face index: ${faceIdx}`);
  }
}
