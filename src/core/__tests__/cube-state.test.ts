import { describe, it, expect } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";

describe("cube state management", () => {
  it("default pattern represents solved state", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    expect(
      solved.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
    ).toBe(true);
  });

  it("applying a move changes state from solved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const afterR = solved.applyMove("R");
    expect(afterR.isIdentical(solved)).toBe(false);
    expect(
      afterR.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
    ).toBe(false);
  });

  it("applying a move and its inverse returns to solved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const afterR = solved.applyMove("R");
    const afterRR = afterR.applyMove("R'");
    expect(afterRR.isIdentical(solved)).toBe(true);
  });

  it("applying a known algorithm and its inverse returns to solved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const afterAlg = solved.applyAlg("R U R' U'");
    expect(afterAlg.isIdentical(solved)).toBe(false);
    const restored = afterAlg.applyAlg("U R U' R'");
    expect(restored.isIdentical(solved)).toBe(true);
  });

  it("state is immutable — applying a move returns a new pattern", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const afterR = solved.applyMove("R");
    // Original should still be solved
    expect(
      solved.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
    ).toBe(true);
    expect(afterR.isIdentical(solved)).toBe(false);
  });

  it("reset to solved is just defaultPattern()", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const scrambled = kpuzzle.defaultPattern().applyAlg("R U F D L B");
    const reset = kpuzzle.defaultPattern();
    expect(
      reset.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
    ).toBe(true);
    expect(reset.isIdentical(scrambled)).toBe(false);
  });
});
