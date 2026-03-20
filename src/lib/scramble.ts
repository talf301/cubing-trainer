import { randomScrambleForEvent } from "cubing/scramble";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern } from "cubing/kpuzzle";

export interface ScrambleResult {
  scramble: string;
  expectedState: KPattern;
}

export async function generateScramble(): Promise<ScrambleResult> {
  const [scrambleAlg, kpuzzle] = await Promise.all([
    randomScrambleForEvent("333"),
    cube3x3x3.kpuzzle(),
  ]);

  const scramble = scrambleAlg.toString();
  console.log("[generateScramble] scrambleAlg type:", scrambleAlg.constructor.name);
  console.log("[generateScramble] scramble string:", JSON.stringify(scramble));
  console.log("[generateScramble] first 5 chars codes:", [...scramble.slice(0, 20)].map(c => c.charCodeAt(0)));
  const solved = kpuzzle.defaultPattern();
  const expectedState = solved.applyAlg(scrambleAlg);

  return { scramble, expectedState };
}
