import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { recognizeOLL, recognizePLL } from "./case-recognizer";
import type { TimestampedMove } from "./solve-session";

const FACE_NAMES = ["U", "L", "F", "R", "B", "D"] as const;
const OPPOSITE_FACE = [5, 3, 4, 1, 2, 0] as const; // U↔D, L↔R, F↔B

export interface FaceGeometry {
  faceEdges: number[][];   // faceEdges[faceIdx] = 4 edge positions
  faceCorners: number[][]; // faceCorners[faceIdx] = 4 corner positions
}

export function buildFaceGeometry(kpuzzle: KPuzzle): FaceGeometry {
  const solved = kpuzzle.defaultPattern();
  const faceEdges: number[][] = [];
  const faceCorners: number[][] = [];

  for (const face of FACE_NAMES) {
    const after = solved.applyMove(face);

    const edges: number[] = [];
    const solvedEdges = solved.patternData["EDGES"];
    const movedEdges = after.patternData["EDGES"];
    for (let i = 0; i < 12; i++) {
      if (movedEdges.pieces[i] !== solvedEdges.pieces[i]) {
        edges.push(i);
      }
    }

    const corners: number[] = [];
    const solvedCorners = solved.patternData["CORNERS"];
    const movedCorners = after.patternData["CORNERS"];
    for (let i = 0; i < 8; i++) {
      if (movedCorners.pieces[i] !== solvedCorners.pieces[i]) {
        corners.push(i);
      }
    }

    faceEdges.push(edges);
    faceCorners.push(corners);
  }

  return { faceEdges, faceCorners };
}

export function isCrossSolved(
  pattern: KPattern,
  geometry: FaceGeometry,
  faceIdx: number,
): boolean {
  const edges = pattern.patternData["EDGES"];
  for (const pos of geometry.faceEdges[faceIdx]) {
    if (edges.pieces[pos] !== pos || edges.orientation[pos] !== 0) {
      return false;
    }
  }
  return true;
}

export function isF2LSolved(
  pattern: KPattern,
  geometry: FaceGeometry,
  crossFaceIdx: number,
): boolean {
  const oppFaceIdx = OPPOSITE_FACE[crossFaceIdx];

  // Check 4 corners adjacent to cross face
  const corners = pattern.patternData["CORNERS"];
  for (const pos of geometry.faceCorners[crossFaceIdx]) {
    if (corners.pieces[pos] !== pos || corners.orientation[pos] !== 0) {
      return false;
    }
  }

  // Check 4 equator edges (not on cross face, not on opposite face)
  const crossEdgeSet = new Set(geometry.faceEdges[crossFaceIdx]);
  const oppEdgeSet = new Set(geometry.faceEdges[oppFaceIdx]);
  const edges = pattern.patternData["EDGES"];
  for (let i = 0; i < 12; i++) {
    if (!crossEdgeSet.has(i) && !oppEdgeSet.has(i)) {
      // This is an equator edge
      if (edges.pieces[i] !== i || edges.orientation[i] !== 0) {
        return false;
      }
    }
  }

  return true;
}

export function isOLLSolved(
  pattern: KPattern,
  geometry: FaceGeometry,
  crossFaceIdx: number,
): boolean {
  const oppFaceIdx = OPPOSITE_FACE[crossFaceIdx];

  // Check orientation of all pieces on opposite face (the OLL face)
  const edges = pattern.patternData["EDGES"];
  for (const pos of geometry.faceEdges[oppFaceIdx]) {
    if (edges.orientation[pos] !== 0) {
      return false;
    }
  }

  const corners = pattern.patternData["CORNERS"];
  for (const pos of geometry.faceCorners[oppFaceIdx]) {
    if (corners.orientation[pos] !== 0) {
      return false;
    }
  }

  return true;
}

export interface CfopSplits {
  crossTime?: number;  // ms relative to solve start
  f2lTime?: number;
  ollTime?: number;
  crossFace?: string;  // "U", "L", "F", "R", "B", "D"
  ollCase?: string;    // e.g., "OLL 27"
  pllCase?: string;    // e.g., "T"
}

// Cache geometry since it's the same for every 3x3 solve
let cachedGeometry: FaceGeometry | null = null;

async function getGeometry(): Promise<{ kpuzzle: KPuzzle; geometry: FaceGeometry }> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  if (!cachedGeometry) {
    cachedGeometry = buildFaceGeometry(kpuzzle);
  }
  return { kpuzzle, geometry: cachedGeometry };
}

const F2L_CHECK_ORDER = [5, 0, 1, 2, 3, 4] as const; // D first for tiebreaking

export async function segmentSolve(
  scramble: string,
  moves: TimestampedMove[],
): Promise<CfopSplits> {
  try {
    const { kpuzzle, geometry } = await getGeometry();
    const splits: CfopSplits = {};

    let state = kpuzzle.defaultPattern().applyAlg(scramble);
    let crossFaceIdx: number | null = null;
    const crossTimes: (number | null)[] = [null, null, null, null, null, null];
    let f2lState: KPattern | null = null;
    let ollState: KPattern | null = null;

    for (const { move, timestamp } of moves) {
      state = state.applyMove(move);

      if (crossFaceIdx === null) {
        // Track cross completion on all 6 faces
        for (let f = 0; f < 6; f++) {
          if (crossTimes[f] === null && isCrossSolved(state, geometry, f)) {
            crossTimes[f] = timestamp;
          }
        }

        // Confirm cross face via F2L detection (check D first for tiebreaking)
        // Also require cross is currently solved (not just historically)
        for (const f of F2L_CHECK_ORDER) {
          if (crossTimes[f] !== null && isCrossSolved(state, geometry, f) && isF2LSolved(state, geometry, f)) {
            crossFaceIdx = f;
            splits.crossTime = crossTimes[f]!;
            splits.crossFace = FACE_NAMES[f];
            splits.f2lTime = timestamp;
            f2lState = state;
            break;
          }
        }
      }

      // Detect OLL (only after F2L is confirmed)
      if (splits.f2lTime !== undefined && splits.ollTime === undefined) {
        if (isOLLSolved(state, geometry, crossFaceIdx!)) {
          splits.ollTime = timestamp;
          ollState = state;
        }
      }
    }

    // Fallback: if F2L was never detected, use earliest cross (prefer D)
    if (crossFaceIdx === null) {
      let earliest: number | null = null;
      for (const f of F2L_CHECK_ORDER) {
        const t = crossTimes[f];
        if (t !== null && (earliest === null || t < earliest)) {
          earliest = t;
          crossFaceIdx = f;
        }
      }
      if (crossFaceIdx !== null) {
        splits.crossTime = earliest!;
        splits.crossFace = FACE_NAMES[crossFaceIdx];
      }
    }

    if (f2lState && splits.crossFace) {
      splits.ollCase = await recognizeOLL(f2lState, splits.crossFace) ?? undefined;
    }
    if (ollState && splits.crossFace) {
      splits.pllCase = await recognizePLL(ollState, splits.crossFace) ?? undefined;
      // Debug: log PLL recognition details
      const oppFaceIdx = OPPOSITE_FACE[crossFaceIdx!];
      const uCorners = Array.from(ollState.patternData["CORNERS"].pieces.slice(0, 8));
      const uEdges = Array.from(ollState.patternData["EDGES"].pieces.slice(0, 12));
      const uCornerOrient = Array.from(ollState.patternData["CORNERS"].orientation.slice(0, 8));
      const uEdgeOrient = Array.from(ollState.patternData["EDGES"].orientation.slice(0, 12));
      console.log("[segmenter] PLL recognition:", {
        crossFace: splits.crossFace,
        pllCase: splits.pllCase ?? "UNRECOGNIZED",
        ollCase: splits.ollCase,
        llCorners: geometry.faceCorners[oppFaceIdx].map(p => uCorners[p]),
        llEdges: geometry.faceEdges[oppFaceIdx].map(p => uEdges[p]),
        llCornerOrient: geometry.faceCorners[oppFaceIdx].map(p => uCornerOrient[p]),
        llEdgeOrient: geometry.faceEdges[oppFaceIdx].map(p => uEdgeOrient[p]),
      });
    } else {
      console.log("[segmenter] PLL recognition skipped:", {
        hasOllState: !!ollState,
        crossFace: splits.crossFace,
        crossFaceIdx,
        f2lDetected: !!f2lState,
        ollTime: splits.ollTime,
      });
    }

    return splits;
  } catch {
    return {};
  }
}
