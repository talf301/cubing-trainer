import type { KPuzzle } from "cubing/kpuzzle";

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
