import type { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { buildFaceGeometry, type FaceGeometry } from "./cfop-segmenter";
import { OLL_CASES } from "./oll-cases";
import { PLL_CASES } from "./pll-cases";

const FACE_NAMES = ["U", "L", "F", "R", "B", "D"] as const;
const OPPOSITE_FACE = [5, 3, 4, 1, 2, 0] as const;

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

export async function recognizeOLL(
  state: KPattern,
  crossFace: string,
): Promise<string | null> {
  const geometry = await getGeometry();
  const crossFaceIdx = FACE_NAMES.indexOf(crossFace as (typeof FACE_NAMES)[number]);
  const ollFaceIdx = OPPOSITE_FACE[crossFaceIdx];
  const ollFaceName = FACE_NAMES[ollFaceIdx];

  const edgePositions = geometry.faceEdges[ollFaceIdx];
  const cornerPositions = geometry.faceCorners[ollFaceIdx];

  // Try all 4 AUF rotations by applying actual last-layer face moves
  for (const [name, caseData] of Object.entries(OLL_CASES)) {
    for (let r = 0; r < 4; r++) {
      const rotated =
        r === 0
          ? state
          : state.applyAlg(
              r === 1 ? ollFaceName : r === 2 ? `${ollFaceName}2` : `${ollFaceName}'`,
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
  const crossFaceIdx = FACE_NAMES.indexOf(crossFace as (typeof FACE_NAMES)[number]);
  const pllFaceIdx = OPPOSITE_FACE[crossFaceIdx];
  const pllFaceName = FACE_NAMES[pllFaceIdx];

  const edgePositions = geometry.faceEdges[pllFaceIdx];
  const cornerPositions = geometry.faceCorners[pllFaceIdx];

  // Try all 4 AUF rotations by applying actual last-layer face moves.
  // This is correct by construction — no manual index adjustment needed.
  for (const [name, caseData] of Object.entries(PLL_CASES)) {
    for (let r = 0; r < 4; r++) {
      const rotated =
        r === 0
          ? state
          : state.applyAlg(
              r === 1 ? pllFaceName : r === 2 ? `${pllFaceName}2` : `${pllFaceName}'`,
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
