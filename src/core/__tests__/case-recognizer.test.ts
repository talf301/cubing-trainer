import { describe, it, expect } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { Alg } from "cubing/alg";
import { OLL_CASES, type CaseFingerprint } from "../oll-cases";
import { PLL_CASES } from "../pll-cases";
import { recognizeOLL, recognizePLL } from "../case-recognizer";

describe("recognizeOLL", () => {
  it("recognizes Sune (OLL 27) from solved + inverse applied", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const inverseAlg = new Alg(OLL_CASES["OLL 27"].algorithm).invert();
    const ollState = solved.applyAlg(inverseAlg);
    const result = await recognizeOLL(ollState, "D");
    expect(result).toBe("OLL 27");
  });

  it("recognizes OLL case with AUF (U pre-move)", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const inverseAlg = new Alg(OLL_CASES["OLL 27"].algorithm).invert();
    const ollState = solved.applyAlg(inverseAlg).applyMove("U");
    const result = await recognizeOLL(ollState, "D");
    expect(result).toBe("OLL 27");
  });

  it("recognizes all 57 OLL cases", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    for (const [name, caseData] of Object.entries(OLL_CASES)) {
      const inverseAlg = new Alg(caseData.algorithm).invert();
      const ollState = solved.applyAlg(inverseAlg);
      const result = await recognizeOLL(ollState, "D");
      expect(result).toBe(name);
    }
  });

  it("returns null for solved cube (no OLL needed)", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const result = await recognizeOLL(solved, "D");
    expect(result).toBeNull();
  });

  it("recognizes OLL with cross on U (OLL face is D)", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    // Construct a realistic U-cross OLL state: D-face pieces have OLL orientations.
    // Conjugate inverse OLL alg by x2 to apply it to D layer instead of U layer.
    const inverseAlg = new Alg(OLL_CASES["OLL 27"].algorithm).invert();
    const ollState = solved.applyAlg("x2").applyAlg(inverseAlg).applyAlg("x2");
    const result = await recognizeOLL(ollState, "U");
    expect(result).toBe("OLL 27");
  });
});

describe("OLL case fingerprints", () => {
  it("contains exactly 57 cases", () => {
    expect(Object.keys(OLL_CASES)).toHaveLength(57);
  });

  // For each OLL case: verify the stored fingerprint matches the actual state,
  // and that applying the algorithm solves OLL
  it.each(Object.entries(OLL_CASES))(
    "%s: fingerprint matches generated state and algorithm solves OLL",
    async (_name, caseData: CaseFingerprint) => {
      const kpuzzle = await cube3x3x3.kpuzzle();
      const solved = kpuzzle.defaultPattern();

      // Build the OLL state by applying inverse of the algorithm
      const inverseAlg = new Alg(caseData.algorithm).invert();
      const ollState = solved.applyAlg(inverseAlg);

      // Verify the stored fingerprint matches the actual extracted orientations
      const actualCorners = [0, 1, 2, 3].map(
        (i) => ollState.patternData["CORNERS"].orientation[i],
      );
      const actualEdges = [0, 1, 2, 3].map(
        (i) => ollState.patternData["EDGES"].orientation[i],
      );
      expect(actualCorners).toEqual(caseData.corners);
      expect(actualEdges).toEqual(caseData.edges);

      // Also verify applying the algorithm solves OLL
      const afterAlg = ollState.applyAlg(caseData.algorithm);
      for (let i = 0; i < 4; i++) {
        expect(afterAlg.patternData["EDGES"].orientation[i]).toBe(0);
        expect(afterAlg.patternData["CORNERS"].orientation[i]).toBe(0);
      }
    },
  );
});

describe("recognizePLL", () => {
  it("recognizes T-perm", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const inverseAlg = new Alg(PLL_CASES["T"].algorithm).invert();
    const pllState = solved.applyAlg(inverseAlg);
    const result = await recognizePLL(pllState, "D");
    expect(result).toBe("T");
  });

  it("recognizes PLL case with AUF", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const inverseAlg = new Alg(PLL_CASES["T"].algorithm).invert();
    const pllState = solved.applyAlg(inverseAlg).applyMove("U");
    const result = await recognizePLL(pllState, "D");
    expect(result).toBe("T");
  });

  it("recognizes all 21 PLL cases", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    for (const [name, caseData] of Object.entries(PLL_CASES)) {
      const inverseAlg = new Alg(caseData.algorithm).invert();
      const pllState = solved.applyAlg(inverseAlg);
      const result = await recognizePLL(pllState, "D");
      expect(result).toBe(name);
    }
  });

  it("returns null for solved cube (PLL skip)", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const result = await recognizePLL(solved, "D");
    expect(result).toBeNull();
  });

  it("recognizes PLL with cross on U (PLL face is D)", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    // Construct a realistic U-cross PLL state: D-face pieces are in T-perm permutation.
    // Conjugate inverse T-perm by x2 to apply it to D layer instead of U layer.
    const inverseAlg = new Alg(PLL_CASES["T"].algorithm).invert();
    const pllState = solved.applyAlg("x2").applyAlg(inverseAlg).applyAlg("x2");
    const result = await recognizePLL(pllState, "U");
    expect(result).toBe("T");
  });
});

describe("PLL case fingerprints", () => {
  it("contains exactly 21 cases", () => {
    expect(Object.keys(PLL_CASES)).toHaveLength(21);
  });

  it.each(Object.entries(PLL_CASES))(
    "%s: fingerprint matches generated state and algorithm solves PLL",
    async (_name, caseData) => {
      const kpuzzle = await cube3x3x3.kpuzzle();
      const solved = kpuzzle.defaultPattern();

      // Build PLL state from inverse algorithm
      const inverseAlg = new Alg(caseData.algorithm).invert();
      const pllState = solved.applyAlg(inverseAlg);

      // Verify the stored fingerprint matches the actual extracted permutations
      const actualCorners = [0, 1, 2, 3].map(
        (i) => pllState.patternData["CORNERS"].pieces[i],
      );
      const actualEdges = [0, 1, 2, 3].map(
        (i) => pllState.patternData["EDGES"].pieces[i],
      );
      expect(actualCorners).toEqual(caseData.corners);
      expect(actualEdges).toEqual(caseData.edges);

      // Verify it's a valid PLL state: all U-layer orientations are 0
      for (let i = 0; i < 4; i++) {
        expect(pllState.patternData["CORNERS"].orientation[i]).toBe(0);
        expect(pllState.patternData["EDGES"].orientation[i]).toBe(0);
      }

      // Apply algorithm — cube should be fully solved
      const afterAlg = pllState.applyAlg(caseData.algorithm);
      expect(Array.from(afterAlg.patternData["EDGES"].pieces.slice(0, 4))).toEqual(
        [0, 1, 2, 3],
      );
      expect(Array.from(afterAlg.patternData["CORNERS"].pieces.slice(0, 4))).toEqual(
        [0, 1, 2, 3],
      );
    },
  );
});
