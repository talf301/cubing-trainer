import type { KPattern, KPuzzle } from "cubing/kpuzzle";

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
