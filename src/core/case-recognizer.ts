import type { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { buildFaceGeometry, type FaceGeometry } from "./cfop-segmenter";
import { OLL_CASES } from "./oll-cases";
import { PLL_CASES } from "./pll-cases";

const FACE_NAMES = ["U", "L", "F", "R", "B", "D"] as const;
const OPPOSITE_FACE = [5, 3, 4, 1, 2, 0] as const;

// Whole-cube rotation to move OLL/PLL face to U (so fingerprints match).
// Key: OLL face index → rotation alg string.
const ROTATION_TO_U: Record<number, string> = {
  0: "",     // U already on top
  1: "z",    // L → U
  2: "x'",   // F → U
  3: "z'",   // R → U
  4: "x",    // B → U
  5: "x2",   // D → U
};

let cachedGeometry: FaceGeometry | null = null;

async function getGeometry(): Promise<FaceGeometry> {
  if (!cachedGeometry) {
    const kpuzzle = await cube3x3x3.kpuzzle();
    cachedGeometry = buildFaceGeometry(kpuzzle);
  }
  return cachedGeometry;
}

function arraysEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

/**
 * Rotate state so the OLL/PLL face (opposite of cross) maps to U.
 * After rotation, U-face positions [0..3] contain the last-layer pieces,
 * making fingerprint comparison face-independent.
 */
function alignToU(state: KPattern, crossFace: string): KPattern {
  const crossFaceIdx = FACE_NAMES.indexOf(crossFace as (typeof FACE_NAMES)[number]);
  const ollFaceIdx = OPPOSITE_FACE[crossFaceIdx];
  const rotation = ROTATION_TO_U[ollFaceIdx];
  if (!rotation) return state;
  return state.applyAlg(rotation);
}

export async function recognizeOLL(
  state: KPattern,
  crossFace: string,
): Promise<string | null> {
  const geometry = await getGeometry();
  // Rotate so OLL face → U, then always read U-face positions
  const aligned = alignToU(state, crossFace);
  const edgePositions = geometry.faceEdges[0]; // U face
  const cornerPositions = geometry.faceCorners[0]; // U face

  for (const [name, caseData] of Object.entries(OLL_CASES)) {
    for (let r = 0; r < 4; r++) {
      const rotated =
        r === 0
          ? aligned
          : aligned.applyAlg(
              r === 1 ? "U" : r === 2 ? "U2" : "U'",
            );
      const edgeOrients = edgePositions.map(
        (pos) => rotated.patternData["EDGES"].orientation[pos],
      );
      const cornerOrients = cornerPositions.map(
        (pos) => rotated.patternData["CORNERS"].orientation[pos],
      );
      if (
        arraysEqual(edgeOrients, caseData.edges) &&
        arraysEqual(cornerOrients, caseData.corners)
      ) {
        return name;
      }
    }
  }

  return null;
}

export async function recognizePLL(
  state: KPattern,
  crossFace: string,
): Promise<string | null> {
  const geometry = await getGeometry();
  // Rotate so PLL face → U, then always read U-face positions
  const aligned = alignToU(state, crossFace);
  const edgePositions = geometry.faceEdges[0]; // U face
  const cornerPositions = geometry.faceCorners[0]; // U face

  for (const [name, caseData] of Object.entries(PLL_CASES)) {
    for (let r = 0; r < 4; r++) {
      const rotated =
        r === 0
          ? aligned
          : aligned.applyAlg(
              r === 1 ? "U" : r === 2 ? "U2" : "U'",
            );
      const edges = edgePositions.map(
        (pos) => rotated.patternData["EDGES"].pieces[pos],
      );
      const corners = cornerPositions.map(
        (pos) => rotated.patternData["CORNERS"].pieces[pos],
      );
      if (arraysEqual(edges, caseData.edges) && arraysEqual(corners, caseData.corners)) {
        return name;
      }
    }
  }

  return null;
}
