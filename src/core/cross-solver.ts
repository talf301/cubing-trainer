import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import { Alg } from "cubing/alg";
import { buildFaceGeometry, isCrossSolved } from "./cfop-segmenter";

const FACE_INDICES: Record<string, number> = {
  U: 0, L: 1, F: 2, R: 3, B: 4, D: 5,
};

const ALL_MOVES = [
  "U", "U'", "U2", "D", "D'", "D2",
  "R", "R'", "R2", "L", "L'", "L2",
  "F", "F'", "F2", "B", "B'", "B2",
];

/**
 * Hash just the cross-edge state for visited detection.
 * Only the 4 cross edge positions and orientations matter — the rest
 * of the cube is irrelevant for finding the optimal cross solution.
 */
function hashCrossState(pattern: KPattern, crossEdges: number[]): string {
  const edges = pattern.patternData["EDGES"];
  let hash = "";
  for (const pos of crossEdges) {
    hash += `${edges.pieces[pos]},${edges.orientation[pos]};`;
  }
  return hash;
}

/**
 * Find the optimal (shortest) solution for the cross on the given face
 * using BFS. The cross state space is ~190K states, so BFS completes
 * in milliseconds.
 *
 * Defaults to U-face cross.
 */
export async function solveOptimalCross(
  kpuzzle: KPuzzle,
  pattern: KPattern,
  crossFace: string = "U",
): Promise<Alg> {
  const faceIdx = FACE_INDICES[crossFace];
  if (faceIdx === undefined) {
    throw new Error(`Invalid cross face: ${crossFace}`);
  }

  const geometry = buildFaceGeometry(kpuzzle);
  const crossEdges = geometry.faceEdges[faceIdx];

  // Check if already solved
  if (isCrossSolved(pattern, geometry, faceIdx)) {
    return new Alg();
  }

  const startTime = performance.now();

  const visited = new Set<string>();
  visited.add(hashCrossState(pattern, crossEdges));

  // BFS queue: [pattern, move sequence]
  let queue: [KPattern, string[]][] = [[pattern, []]];

  while (queue.length > 0) {
    const nextQueue: [KPattern, string[]][] = [];

    for (const [state, moves] of queue) {
      for (const move of ALL_MOVES) {
        const newState = state.applyMove(move);
        const hash = hashCrossState(newState, crossEdges);

        if (visited.has(hash)) continue;
        visited.add(hash);

        if (isCrossSolved(newState, geometry, faceIdx)) {
          const solution = [...moves, move];
          const elapsed = (performance.now() - startTime).toFixed(0);
          console.log(
            `[cross-solver] Solved in ${elapsed}ms (${solution.length} moves, ${visited.size} states explored): ${solution.join(" ")}`,
          );
          return new Alg(solution.join(" "));
        }

        nextQueue.push([newState, [...moves, move]]);
      }
    }

    queue = nextQueue;
  }

  throw new Error("No cross solution found");
}
