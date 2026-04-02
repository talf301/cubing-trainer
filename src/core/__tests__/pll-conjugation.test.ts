import { describe, it, expect } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { PLL_CASES } from "../pll-cases";
import { recognizePLL } from "../case-recognizer";
import { PllSpamSession } from "../pll-spam-session";
import { Alg } from "cubing/alg";

async function applyAlgToSpam(
  session: PllSpamSession,
  state: any,
  alg: string,
  startTime: number,
  moveInterval: number,
) {
  const parsed = new Alg(alg);
  let t = startTime;
  for (const node of parsed.childAlgNodes()) {
    const moveStr = node.toString();
    state = state.applyAlg(moveStr);
    t += moveInterval;
    await session.onMove(moveStr, t, state);
  }
  return { state, time: t };
}

describe("PLL conjugation fix", () => {
  it("recognizePLL finds conjugated Aa (U Aa' U')", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    // Create Aa conjugated by U: corners cycle (1,3,2) instead of (0,2,1)
    const aaInverse = new Alg(PLL_CASES["Aa"].algorithm).invert().toString();
    const state = solved.applyAlg(`U ${aaInverse} U'`);
    
    const corners = Array.from(state.patternData["CORNERS"].pieces.slice(0, 4));
    console.log("Conjugated Aa corners:", corners);
    expect(corners).toEqual([0, 3, 1, 2]); // verify it's the expected conjugation

    const result = await recognizePLL(state, "D");
    expect(result).toBe("Aa");
  });

  it("recognizePLL finds conjugated Ab", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const abInverse = new Alg(PLL_CASES["Ab"].algorithm).invert().toString();
    const state = solved.applyAlg(`U ${abInverse} U'`);
    const result = await recognizePLL(state, "D");
    expect(result).toBe("Ab");
  });

  it("recognizePLL finds all 21 PLLs conjugated by U", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    for (const [name, caseData] of Object.entries(PLL_CASES)) {
      const inv = new Alg(caseData.algorithm).invert().toString();
      const state = solved.applyAlg(`U ${inv} U'`);
      const result = await recognizePLL(state, "D");
      expect(result).toBe(name);
    }
  });

  it("recognizePLL finds all 21 PLLs conjugated by U2", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    for (const [name, caseData] of Object.entries(PLL_CASES)) {
      const inv = new Alg(caseData.algorithm).invert().toString();
      const state = solved.applyAlg(`U2 ${inv} U2`);
      const result = await recognizePLL(state, "D");
      expect(result).toBe(name);
    }
  });

  it("spam session detects conjugated Aa via delta", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const session = new PllSpamSession();
    const completions: any[] = [];
    session.addCompletionListener((c) => completions.push(c));

    // Set baseline
    await session.onMove("U", 0, solved);

    // Apply conjugated Aa: U Aa U' (this IS a valid PLL from solved)
    const aaAlg = PLL_CASES["Aa"].algorithm;
    const conjAlg = `U ${aaAlg} U'`;
    await applyAlgToSpam(session, solved, conjAlg, 1000, 50);

    expect(completions).toHaveLength(1);
    expect(completions[0].caseName).toBe("Aa");
  });

  it("no regressions: all 21 standard PLLs still detected", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    for (const [name, caseData] of Object.entries(PLL_CASES)) {
      const inverseAlg = new Alg(caseData.algorithm).invert();
      const pllState = solved.applyAlg(inverseAlg);
      const result = await recognizePLL(pllState, "D");
      expect(result).toBe(name);
    }
  });

  it("no false positives: solved cube is null", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const result = await recognizePLL(kpuzzle.defaultPattern(), "D");
    expect(result).toBeNull();
  });
});
