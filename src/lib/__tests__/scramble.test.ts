import { describe, it, expect, vi, beforeEach } from "vitest";
import { generateScramble } from "@/lib/scramble";

// cubing/scramble relies on Web Workers for its search engine, which are not
// available in the Vitest/Node 18 environment. We mock the module here and
// test that generateScramble correctly wires the scramble alg into a KPattern.
vi.mock("cubing/scramble", () => ({
  randomScrambleForEvent: vi.fn(),
}));

describe("generateScramble", () => {
  beforeEach(async () => {
    const { randomScrambleForEvent } = await import("cubing/scramble");
    const { Alg } = await import("cubing/alg");
    vi.mocked(randomScrambleForEvent).mockResolvedValue(
      Alg.fromString("R U R' U'"),
    );
  });

  it("returns a scramble string and expected pattern", async () => {
    const result = await generateScramble();
    expect(typeof result.scramble).toBe("string");
    expect(result.scramble.length).toBeGreaterThan(0);
    expect(result.expectedState).toBeDefined();
  });

  it("expected state is not solved", async () => {
    const result = await generateScramble();
    expect(
      result.expectedState.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
    ).toBe(false);
  });

  it("expected state matches applying scramble to solved", async () => {
    const { cube3x3x3 } = await import("cubing/puzzles");
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();

    const result = await generateScramble();
    const manuallyScrambled = solved.applyAlg(result.scramble);
    expect(result.expectedState.isIdentical(manuallyScrambled)).toBe(true);
  });
});
