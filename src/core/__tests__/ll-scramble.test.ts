import { describe, it, expect, vi, beforeEach } from "vitest";
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern } from "cubing/kpuzzle";

// cubing/search relies on Web Workers which are not available in
// Vitest/Node 18. Mock the solver so we can test the scramble
// construction logic without needing workers.
vi.mock("cubing/search", () => ({
  experimentalSolve3x3x3IgnoringCenters: vi.fn(),
}));

import { generateLLScramble, warmupSolver } from "../ll-scramble";
import {
  buildFaceGeometry,
  isCrossSolved,
  isF2LSolved,
} from "../cfop-segmenter";

// The mock solver returns the actual solution for the given pattern
// by computing it from the known inverse relationship.
async function setupMockSolver() {
  const { experimentalSolve3x3x3IgnoringCenters } = await import(
    "cubing/search"
  );
  await cube3x3x3.kpuzzle();

  // The mock solver: given a pattern, find a move sequence that "solves" it.
  // We simulate the solver by returning a short known alg. The key insight:
  // the solver's job is to find moves that take the pattern back to solved.
  // For testing, we just return a fixed alg. The module will invert it for
  // the scramble.
  vi.mocked(experimentalSolve3x3x3IgnoringCenters).mockImplementation(
    async (_pattern: KPattern) => {
      // Return a simple alg — the test verifies the wiring, not the solver.
      // We return an identity-like alg that the module will invert.
      // Actually, let's compute a real "solution" by hand:
      // The module gives us a target state T, expects us to return S such that
      // T.applyAlg(S) = solved. So S = inverse(target_setup_alg).
      // We can't easily compute that without a real solver, so we return
      // a fixed known alg and verify the scramble wiring is correct.
      return new Alg("R U R' F'");
    },
  );
}

describe("warmupSolver", () => {
  beforeEach(async () => {
    const { experimentalSolve3x3x3IgnoringCenters } = await import(
      "cubing/search"
    );
    vi.mocked(experimentalSolve3x3x3IgnoringCenters).mockResolvedValue(
      new Alg(),
    );
  });

  it("calls the solver to warm it up", async () => {
    const { experimentalSolve3x3x3IgnoringCenters } = await import(
      "cubing/search"
    );
    await warmupSolver();
    expect(experimentalSolve3x3x3IgnoringCenters).toHaveBeenCalledTimes(1);
  });
});

describe("generateLLScramble", () => {
  beforeEach(async () => {
    await setupMockSolver();
  });

  it("returns a scramble string and expectedState", async () => {
    const result = await generateLLScramble();
    expect(typeof result.scramble).toBe("string");
    expect(result.scramble.length).toBeGreaterThan(0);
    expect(result.expectedState).toBeDefined();
  });

  it("calls the solver with a KPattern", async () => {
    const { experimentalSolve3x3x3IgnoringCenters } = await import(
      "cubing/search"
    );
    vi.mocked(experimentalSolve3x3x3IgnoringCenters).mockClear();
    await generateLLScramble();
    expect(experimentalSolve3x3x3IgnoringCenters).toHaveBeenCalledTimes(1);
    const arg = vi.mocked(experimentalSolve3x3x3IgnoringCenters).mock
      .calls[0][0];
    // Should be a KPattern (has patternData)
    expect(arg).toHaveProperty("patternData");
  });

  it("scramble is the inverse of the solver result", async () => {
    const { experimentalSolve3x3x3IgnoringCenters } = await import(
      "cubing/search"
    );
    const solverResult = new Alg("R U R' F'");
    vi.mocked(experimentalSolve3x3x3IgnoringCenters).mockResolvedValue(
      solverResult,
    );

    const result = await generateLLScramble();

    // The scramble should be the inverse of what the solver returned,
    // with X2' normalized to X2
    const expectedScramble = solverResult.invert().toString().replace(/(\w)2'/g, "$12");
    expect(result.scramble).toBe(expectedScramble);
  });

  it("normalizes X2' to X2 in scramble string", async () => {
    const { experimentalSolve3x3x3IgnoringCenters } = await import(
      "cubing/search"
    );
    // Solver returns alg with a double move; its inverse would contain R2'
    vi.mocked(experimentalSolve3x3x3IgnoringCenters).mockResolvedValue(
      new Alg("R2 U F'"),
    );

    const result = await generateLLScramble();

    // cubing.js invert() produces "F U' R2'" — we normalize to "F U' R2"
    expect(result.scramble).toBe("F U' R2");
    expect(result.scramble).not.toContain("2'");
  });

  it("expectedState matches applying scramble to solved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();

    const result = await generateLLScramble();
    const manuallyScrambled = solved.applyAlg(result.scramble);

    expect(
      result.expectedState.isIdentical(manuallyScrambled),
    ).toBe(true);
  });

  it("target state passed to solver has F2L solved", async () => {
    const { experimentalSolve3x3x3IgnoringCenters } = await import(
      "cubing/search"
    );
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const FACE_D = 5;

    await generateLLScramble();

    const targetState = vi.mocked(experimentalSolve3x3x3IgnoringCenters).mock
      .calls[0][0] as KPattern;

    // The target state should have D-cross and F2L solved
    // (it's a LL-only scramble state)
    expect(isCrossSolved(targetState, geometry, FACE_D)).toBe(true);
    expect(isF2LSolved(targetState, geometry, FACE_D)).toBe(true);
  });

  it("target state is not fully solved (has LL work)", async () => {
    const { experimentalSolve3x3x3IgnoringCenters } = await import(
      "cubing/search"
    );
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();

    // Run multiple times to be robust against the rare skip case
    let foundUnsolved = false;
    for (let i = 0; i < 10; i++) {
      vi.mocked(experimentalSolve3x3x3IgnoringCenters).mockClear();
      await setupMockSolver();
      await generateLLScramble();

      const targetState = vi.mocked(experimentalSolve3x3x3IgnoringCenters).mock
        .calls[0][0] as KPattern;
      if (!targetState.isIdentical(solved)) {
        foundUnsolved = true;
        break;
      }
    }
    expect(foundUnsolved).toBe(true);
  });
});
