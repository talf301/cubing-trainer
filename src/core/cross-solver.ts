import { KPattern } from "cubing/kpuzzle";
import type { KPuzzle } from "cubing/kpuzzle";
import type { Alg } from "cubing/alg";
import { experimentalSolveTwips } from "cubing/search";
import { buildFaceGeometry } from "./cfop-segmenter";

/**
 * Build a KPattern where only the 4 cross edges for the given face are
 * constrained to their solved positions/orientations.  Every other piece
 * is "don't-care" (orientationMod = 1 means any orientation/piece matches).
 */
function buildCrossTarget(kpuzzle: KPuzzle, faceIdx: number): KPattern {
  const geometry = buildFaceGeometry(kpuzzle);
  const crossEdges = new Set(geometry.faceEdges[faceIdx]);
  const solved = kpuzzle.defaultPattern();

  const numEdges = solved.patternData["EDGES"].pieces.length;
  const numCorners = solved.patternData["CORNERS"].pieces.length;
  const numCenters = solved.patternData["CENTERS"].pieces.length;

  // Edges: constrain only the 4 cross edges to solved position+orientation
  const edgePieces = new Array(numEdges).fill(0);
  const edgeOrientation = new Array(numEdges).fill(0);
  const edgeOrientationMod = new Array(numEdges).fill(1); // don't-care

  for (const pos of crossEdges) {
    edgePieces[pos] = solved.patternData["EDGES"].pieces[pos];
    edgeOrientation[pos] = 0;
    edgeOrientationMod[pos] = 0; // fully constrained
  }

  // Corners: all don't-care
  const cornerPieces = new Array(numCorners).fill(0);
  const cornerOrientation = new Array(numCorners).fill(0);
  const cornerOrientationMod = new Array(numCorners).fill(1);

  // Centers: all don't-care
  const centerPieces = new Array(numCenters).fill(0);
  const centerOrientation = new Array(numCenters).fill(0);
  const centerOrientationMod = new Array(numCenters).fill(1);

  return new KPattern(kpuzzle, {
    EDGES: {
      pieces: edgePieces,
      orientation: edgeOrientation,
      orientationMod: edgeOrientationMod,
    },
    CORNERS: {
      pieces: cornerPieces,
      orientation: cornerOrientation,
      orientationMod: cornerOrientationMod,
    },
    CENTERS: {
      pieces: centerPieces,
      orientation: centerOrientation,
      orientationMod: centerOrientationMod,
    },
  });
}

const FACE_INDICES: Record<string, number> = {
  U: 0, L: 1, F: 2, R: 3, B: 4, D: 5,
};

export interface CrossSolverOptions {
  timeoutMs?: number;
}

/**
 * Find the optimal (shortest) solution for the cross on the given face.
 * Defaults to U-face cross.
 */
export async function solveOptimalCross(
  kpuzzle: KPuzzle,
  pattern: KPattern,
  crossFace: string = "U",
  options: CrossSolverOptions = {},
): Promise<Alg> {
  const { timeoutMs = 30_000 } = options;

  const faceIdx = FACE_INDICES[crossFace];
  if (faceIdx === undefined) {
    throw new Error(`Invalid cross face: ${crossFace}`);
  }

  const targetPattern = buildCrossTarget(kpuzzle, faceIdx);

  console.log(`[cross-solver] Starting solve for ${crossFace}-face cross`);
  const startTime = performance.now();

  const solverPromise = experimentalSolveTwips(kpuzzle, pattern, {
    targetPattern,
  });

  console.log(`[cross-solver] experimentalSolveTwips called, promise:`, solverPromise);

  solverPromise.then(
    (alg) => console.log(`[cross-solver] Solver resolved:`, alg.toString()),
    (err) => console.error(`[cross-solver] Solver rejected:`, err),
  );

  let timeoutId: ReturnType<typeof setTimeout>;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Cross solver timed out")), timeoutMs);
  });

  try {
    const result = await Promise.race([solverPromise, timeoutPromise]);
    clearTimeout(timeoutId!);

    const elapsed = (performance.now() - startTime).toFixed(0);
    console.log(`[cross-solver] Solved in ${elapsed}ms: ${result.toString()}`);

    return result;
  } catch (err) {
    clearTimeout(timeoutId!);
    const elapsed = (performance.now() - startTime).toFixed(0);
    console.error(`[cross-solver] Failed after ${elapsed}ms:`, err);
    throw err;
  }
}
