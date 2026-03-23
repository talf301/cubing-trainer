import { describe, it, expect, vi, beforeEach } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { Alg } from "cubing/alg";
import { solveOptimalCross } from "../cross-solver";
import { buildFaceGeometry } from "../cfop-segmenter";

// Mock experimentalSolveTwips since cubing.js search workers
// don't work in Vitest's jsdom/node environment
vi.mock("cubing/search", () => ({
  experimentalSolveTwips: vi.fn(),
}));

import { experimentalSolveTwips } from "cubing/search";
const mockSolveTwips = vi.mocked(experimentalSolveTwips);

describe("solveOptimalCross", () => {
  beforeEach(() => {
    mockSolveTwips.mockReset();
  });

  it("throws for invalid cross face", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    await expect(solveOptimalCross(kpuzzle, solved, "X")).rejects.toThrow(
      "Invalid cross face: X",
    );
  });

  it("calls experimentalSolveTwips with a target pattern constraining only cross edges", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    mockSolveTwips.mockResolvedValue(new Alg(""));

    await solveOptimalCross(kpuzzle, solved, "D");

    expect(mockSolveTwips).toHaveBeenCalledOnce();
    const [calledKpuzzle, calledPattern, options] = mockSolveTwips.mock.calls[0];
    expect(calledKpuzzle).toBe(kpuzzle);
    expect(calledPattern).toBe(solved);

    // Verify the target pattern has orientationMod set correctly
    const targetPattern = options!.targetPattern!;
    const edges = targetPattern.patternData["EDGES"];
    const geometry = buildFaceGeometry(kpuzzle);
    const crossEdgeSet = new Set(geometry.faceEdges[5]); // D face

    // Cross edges should be fully constrained (orientationMod = 0)
    for (const pos of crossEdgeSet) {
      expect(edges.orientationMod![pos]).toBe(0);
    }

    // Non-cross edges should be don't-care (orientationMod = 1)
    for (let i = 0; i < edges.pieces.length; i++) {
      if (!crossEdgeSet.has(i)) {
        expect(edges.orientationMod![i]).toBe(1);
      }
    }

    // All corners should be don't-care
    const corners = targetPattern.patternData["CORNERS"];
    for (let i = 0; i < corners.pieces.length; i++) {
      expect(corners.orientationMod![i]).toBe(1);
    }
  });

  it("defaults to U-face cross", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    mockSolveTwips.mockResolvedValue(new Alg(""));

    await solveOptimalCross(kpuzzle, solved);

    const [, , options] = mockSolveTwips.mock.calls[0];
    const targetPattern = options!.targetPattern!;
    const edges = targetPattern.patternData["EDGES"];
    const geometry = buildFaceGeometry(kpuzzle);
    const uCrossEdges = new Set(geometry.faceEdges[0]);

    // U-face cross edges should be constrained
    for (const pos of uCrossEdges) {
      expect(edges.orientationMod![pos]).toBe(0);
    }
  });

  it("constrains U-face edges when crossFace is U", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    mockSolveTwips.mockResolvedValue(new Alg(""));

    await solveOptimalCross(kpuzzle, solved, "U");

    const [, , options] = mockSolveTwips.mock.calls[0];
    const targetPattern = options!.targetPattern!;
    const edges = targetPattern.patternData["EDGES"];
    const geometry = buildFaceGeometry(kpuzzle);
    const uCrossEdges = new Set(geometry.faceEdges[0]);

    // U-face cross edges should be constrained
    for (const pos of uCrossEdges) {
      expect(edges.orientationMod![pos]).toBe(0);
    }

    // Non-U-face edges should be don't-care
    for (let i = 0; i < edges.pieces.length; i++) {
      if (!uCrossEdges.has(i)) {
        expect(edges.orientationMod![i]).toBe(1);
      }
    }
  });

  it("returns the alg from experimentalSolveTwips", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const expectedAlg = new Alg("R U R'");
    mockSolveTwips.mockResolvedValue(expectedAlg);

    const result = await solveOptimalCross(kpuzzle, solved);
    expect(result).toBe(expectedAlg);
  });
});
