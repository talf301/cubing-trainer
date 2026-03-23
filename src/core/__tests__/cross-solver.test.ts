import { describe, it, expect } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { solveOptimalCross } from "../cross-solver";
import { buildFaceGeometry, isCrossSolved } from "../cfop-segmenter";

describe("solveOptimalCross", () => {
  it("throws for invalid cross face", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    await expect(solveOptimalCross(kpuzzle, solved, "X")).rejects.toThrow(
      "Invalid cross face: X",
    );
  });

  it("returns empty alg for already-solved cross", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const result = await solveOptimalCross(kpuzzle, solved, "U");
    expect(result.toString()).toBe("");
  });

  it("solves a 1-move cross", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    // R disrupts one U-face cross edge
    const scrambled = solved.applyMove("R");

    const result = await solveOptimalCross(kpuzzle, scrambled, "U");
    // Verify the solution actually solves the cross
    const afterSolve = scrambled.applyAlg(result);
    const geometry = buildFaceGeometry(kpuzzle);
    expect(isCrossSolved(afterSolve, geometry, 0)).toBe(true);
    // Should be optimal (1 move)
    expect(result.toString().split(" ").length).toBe(1);
  });

  it("solves a multi-move cross", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const scrambled = solved.applyAlg("R U F' L2");

    const result = await solveOptimalCross(kpuzzle, scrambled, "U");
    const afterSolve = scrambled.applyAlg(result);
    const geometry = buildFaceGeometry(kpuzzle);
    expect(isCrossSolved(afterSolve, geometry, 0)).toBe(true);
    // Should be at most 4 moves (inverse of scramble)
    expect(result.toString().split(" ").length).toBeLessThanOrEqual(4);
  });

  it("defaults to U-face cross", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const scrambled = solved.applyMove("R");

    // No face specified — should solve U-face cross
    const result = await solveOptimalCross(kpuzzle, scrambled);
    const afterSolve = scrambled.applyAlg(result);
    const geometry = buildFaceGeometry(kpuzzle);
    expect(isCrossSolved(afterSolve, geometry, 0)).toBe(true);
  });

  it("solves D-face cross when specified", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const scrambled = solved.applyMove("R");

    const result = await solveOptimalCross(kpuzzle, scrambled, "D");
    const afterSolve = scrambled.applyAlg(result);
    const geometry = buildFaceGeometry(kpuzzle);
    expect(isCrossSolved(afterSolve, geometry, 5)).toBe(true);
  });

  it("finds optimal solution length", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    // R U disrupts cross; optimal undo is U' R' (2 moves)
    const scrambled = solved.applyAlg("R U");

    const result = await solveOptimalCross(kpuzzle, scrambled, "U");
    const moves = result.toString().split(" ");
    expect(moves.length).toBeLessThanOrEqual(2);

    // Verify it actually solves
    const afterSolve = scrambled.applyAlg(result);
    const geometry = buildFaceGeometry(kpuzzle);
    expect(isCrossSolved(afterSolve, geometry, 0)).toBe(true);
  });
});
