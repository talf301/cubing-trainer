import { randomScrambleForEvent } from "cubing/scramble";
import { cube3x3x3 } from "cubing/puzzles";
import { Alg } from "cubing/alg";
import type { KPattern } from "cubing/kpuzzle";

export interface ScrambleResult {
  scramble: string;
  expectedState: KPattern;
}

export async function generateScramble(
  currentState?: KPattern,
): Promise<ScrambleResult> {
  const kpuzzle = await cube3x3x3.kpuzzle();

  const scrambleAlg = await randomScrambleForEvent("333");
  const scrambleStr = scrambleAlg.toString();

  const alg = new Alg(scrambleStr);
  const base = currentState ?? kpuzzle.defaultPattern();
  const expectedState = base.applyAlg(alg);

  return { scramble: scrambleStr, expectedState };
}
