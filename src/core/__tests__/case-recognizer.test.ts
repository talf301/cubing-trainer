import { describe, it, expect } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { Alg } from "cubing/alg";
import { OLL_CASES, type CaseFingerprint } from "../oll-cases";

describe("OLL case fingerprints", () => {
  it("contains exactly 57 cases", () => {
    expect(Object.keys(OLL_CASES)).toHaveLength(57);
  });

  // For each OLL case: verify the stored fingerprint matches the actual state,
  // and that applying the algorithm solves OLL
  it.each(Object.entries(OLL_CASES))(
    "%s: fingerprint matches generated state and algorithm solves OLL",
    async (name, caseData: CaseFingerprint) => {
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
