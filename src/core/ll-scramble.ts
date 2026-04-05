import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { experimentalSolve3x3x3IgnoringCenters } from "cubing/search";
import type { KPattern } from "cubing/kpuzzle";
import { OLL_CASES } from "./oll-cases";
import { PLL_CASES } from "./pll-cases";

export interface LLScrambleResult {
  scramble: string;
  expectedState: KPattern;
}

const AUF_MOVES = ["", "U", "U2", "U'"];

/**
 * Generate a scramble that produces a random last-layer state
 * (F2L pre-solved, random OLL + PLL + AUF).
 *
 * 1. Pick random OLL, PLL, and AUF.
 * 2. Build the target KPattern: solved → inverse(PLL) → inverse(OLL) → AUF.
 * 3. Use the 3x3 solver to find a solution for that pattern.
 * 4. Return the inverse of the solution as the scramble.
 */
export async function generateLLScramble(): Promise<LLScrambleResult> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();

  // Pick random cases
  const ollKeys = Object.keys(OLL_CASES);
  const pllKeys = Object.keys(PLL_CASES);
  const ollCase = OLL_CASES[ollKeys[Math.floor(Math.random() * ollKeys.length)]];
  const pllCase = PLL_CASES[pllKeys[Math.floor(Math.random() * pllKeys.length)]];
  const auf = AUF_MOVES[Math.floor(Math.random() * AUF_MOVES.length)];

  // Build target state: inverse(PLL) → inverse(OLL) → AUF applied to solved
  const inversePLL = new Alg(pllCase.algorithm).invert();
  const inverseOLL = new Alg(ollCase.algorithm).invert();

  let targetState = solved.applyAlg(inversePLL);
  targetState = targetState.applyAlg(inverseOLL);
  if (auf) {
    targetState = targetState.applyAlg(auf);
  }

  // Solve: find a move sequence that takes targetState → solved
  const solution = await experimentalSolve3x3x3IgnoringCenters(targetState);

  // Scramble is the inverse of the solution
  const scrambleAlg = solution.invert();
  const scramble = scrambleAlg.toString();

  // The expected state after applying scramble to solved cube
  const expectedState = solved.applyAlg(scrambleAlg);

  return { scramble, expectedState };
}

/**
 * Warm up the 3x3 solver worker so subsequent calls are fast.
 * Call this on page load — first solve takes ~750ms, later ones 1-5ms.
 */
export async function warmupSolver(): Promise<void> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();
  // Solve an already-solved cube to trigger worker initialization
  await experimentalSolve3x3x3IgnoringCenters(solved);
}
