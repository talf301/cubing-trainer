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
// Home piece indices for U-face positions after each alignment rotation.
// Maps each rotation to the pieces that should be at U-face positions in the solved state.
// Used to normalize PLL piece indices to 0-3 for fingerprint matching.
let cachedHomePieces: { edges: Map<number, number>; corners: Map<number, number> } | null = null;
let cachedHomeCrossFace: string | null = null;

async function getGeometry(): Promise<FaceGeometry> {
  if (!cachedGeometry) {
    const kpuzzle = await cube3x3x3.kpuzzle();
    cachedGeometry = buildFaceGeometry(kpuzzle);
  }
  return cachedGeometry;
}

/**
 * Get a mapping from absolute piece indices to relative 0-3 indices
 * for the U-face positions after alignment for a given cross face.
 * For D cross (no rotation), home pieces are [0,1,2,3] so mapping is identity.
 * For U cross (x2 rotation), home pieces are [4-7] range, mapped to 0-3.
 */
async function getHomePieceMapping(
  crossFace: string,
  geometry: FaceGeometry,
): Promise<{ edges: Map<number, number>; corners: Map<number, number> }> {
  if (cachedHomePieces && cachedHomeCrossFace === crossFace) {
    return cachedHomePieces;
  }
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solvedAligned = alignToU(kpuzzle.defaultPattern(), crossFace);
  const edgePositions = geometry.faceEdges[0];
  const cornerPositions = geometry.faceCorners[0];

  const edges = new Map<number, number>();
  edgePositions.forEach((pos, i) => {
    edges.set(solvedAligned.patternData["EDGES"].pieces[pos], i);
  });

  const corners = new Map<number, number>();
  cornerPositions.forEach((pos, i) => {
    corners.set(solvedAligned.patternData["CORNERS"].pieces[pos], i);
  });

  cachedHomePieces = { edges, corners };
  cachedHomeCrossFace = crossFace;
  return cachedHomePieces;
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

  // Normalize piece indices to 0-3 relative to the aligned solved state.
  // For D cross, U-face home pieces are [0,1,2,3] so this is identity.
  // For other cross faces, the home pieces differ (e.g., U cross → [4,5,6,7] range).
  const homeMap = await getHomePieceMapping(crossFace, geometry);

  // Try 4 AUF rotations × 4 conjugations. Conjugation is needed because
  // cube rotations (x/y/z) during PLL algorithms cause GAN smart cubes
  // to track moves in a shifted frame, producing a conjugated permutation.
  const rotAlgs = ["", "U", "U2", "U'"];
  for (const aufAlg of rotAlgs) {
    const rotated =
      aufAlg === ""
        ? aligned
        : aligned.applyAlg(aufAlg);
    const edges = edgePositions.map(
      (pos) => homeMap.edges.get(rotated.patternData["EDGES"].pieces[pos])!,
    );
    const corners = cornerPositions.map(
      (pos) => homeMap.corners.get(rotated.patternData["CORNERS"].pieces[pos])!,
    );

    for (const [name, caseData] of Object.entries(PLL_CASES)) {
      // Direct match (no conjugation)
      if (arraysEqual(edges, caseData.edges) && arraysEqual(corners, caseData.corners)) {
        return name;
      }
      // Try 3 conjugations by U (cyclic shift of positions)
      for (let c = 1; c < 4; c++) {
        const conjCorners = conjugateByU(caseData.corners, c);
        const conjEdges = conjugateByU(caseData.edges, c);
        if (arraysEqual(edges, conjEdges) && arraysEqual(corners, conjCorners)) {
          return name;
        }
      }
    }
  }

  return null;
}

/**
 * Conjugate a permutation array by U^c (cyclic shift of positions).
 * If U maps position i → (i+1)%4, then conjugation U^c · P · U^{-c} gives:
 *   result[i] = (P[(i - c + 4) % 4] + c) % 4
 */
function conjugateByU(perm: number[], c: number): number[] {
  return perm.map((_, i) => (perm[(i - c + 4) % 4] + c) % 4);
}
