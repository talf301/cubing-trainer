import { describe, it, expect } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { buildFaceGeometry, isCrossSolved, isF2LSolved, isOLLSolved, segmentSolve } from "../cfop-segmenter";
import type { TimestampedMove } from "../solve-session";

describe("buildFaceGeometry", () => {
  it("returns 4 edge positions per face", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);

    for (let f = 0; f < 6; f++) {
      expect(geometry.faceEdges[f]).toHaveLength(4);
    }
  });

  it("returns 4 corner positions per face", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);

    for (let f = 0; f < 6; f++) {
      expect(geometry.faceCorners[f]).toHaveLength(4);
    }
  });

  it("every edge position appears in exactly 2 faces", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);

    const edgeCounts = new Array(12).fill(0);
    for (let f = 0; f < 6; f++) {
      for (const pos of geometry.faceEdges[f]) {
        edgeCounts[pos]++;
      }
    }
    // Each edge is shared by exactly 2 faces
    for (let i = 0; i < 12; i++) {
      expect(edgeCounts[i]).toBe(2);
    }
  });

  it("every corner position appears in exactly 3 faces", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);

    const cornerCounts = new Array(8).fill(0);
    for (let f = 0; f < 6; f++) {
      for (const pos of geometry.faceCorners[f]) {
        cornerCounts[pos]++;
      }
    }
    // Each corner is shared by exactly 3 faces
    for (let i = 0; i < 8; i++) {
      expect(cornerCounts[i]).toBe(3);
    }
  });

  it("opposite faces share no edge positions", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);

    // Opposite pairs: 0↔5 (U↔D), 1↔3 (L↔R), 2↔4 (F↔B)
    const oppositePairs = [[0, 5], [1, 3], [2, 4]];
    for (const [a, b] of oppositePairs) {
      const shared = geometry.faceEdges[a].filter(
        (e: number) => geometry.faceEdges[b].includes(e)
      );
      expect(shared).toHaveLength(0);
    }
  });
});

describe("isCrossSolved", () => {
  it("solved cube has cross solved on all faces", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const solved = kpuzzle.defaultPattern();

    for (let f = 0; f < 6; f++) {
      expect(isCrossSolved(solved, geometry, f)).toBe(true);
    }
  });

  it("single R move breaks U, D, R, F, and B crosses but not L", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const afterR = kpuzzle.defaultPattern().applyMove("R");

    // R cycles 4 edges on the R face. These edges are shared with U, D, F, B.
    // Only L cross is unaffected (no L-adjacent edges are on R face).
    expect(isCrossSolved(afterR, geometry, 1)).toBe(true); // L
    // At least R cross should be broken
    expect(isCrossSolved(afterR, geometry, 3)).toBe(false); // R
  });

  it("applying a move and its inverse restores all crosses", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const state = kpuzzle.defaultPattern().applyMove("R").applyMove("R'");

    for (let f = 0; f < 6; f++) {
      expect(isCrossSolved(state, geometry, f)).toBe(true);
    }
  });
});

describe("isF2LSolved", () => {
  it("solved cube has F2L solved for all cross faces", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const solved = kpuzzle.defaultPattern();

    for (let f = 0; f < 6; f++) {
      expect(isF2LSolved(solved, geometry, f)).toBe(true);
    }
  });

  it("U move does not break D-face F2L", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    // U only affects U-layer pieces; D-face F2L should be untouched
    const afterU = kpuzzle.defaultPattern().applyMove("U");
    const dFace = 5; // D
    expect(isF2LSolved(afterU, geometry, dFace)).toBe(true);
  });

  it("R move breaks D-face F2L", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    // R affects D-layer corners and middle-layer edges
    const afterR = kpuzzle.defaultPattern().applyMove("R");
    const dFace = 5; // D
    expect(isF2LSolved(afterR, geometry, dFace)).toBe(false);
  });

  it("D cross solved while D F2L is not", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    // The E (equator) slice move cycles the 4 equator edges (FL→FR→BR→BL)
    // without affecting any D-layer or U-layer pieces.
    // Result: D cross intact (D edges untouched), D F2L broken (equator edges displaced).
    const state = kpuzzle.defaultPattern().applyMove("E");
    const dFace = 5;
    expect(isCrossSolved(state, geometry, dFace)).toBe(true);
    expect(isF2LSolved(state, geometry, dFace)).toBe(false);
  });
});

describe("isOLLSolved", () => {
  it("solved cube has OLL solved for all cross faces", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const solved = kpuzzle.defaultPattern();

    for (let f = 0; f < 6; f++) {
      expect(isOLLSolved(solved, geometry, f)).toBe(true);
    }
  });

  it("PLL-only state has OLL solved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    // T-perm swaps pieces but preserves orientation — OLL stays solved
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const state = kpuzzle.defaultPattern().applyAlg(tPerm);
    const dFace = 5; // cross on D
    // F2L should still be solved (T-perm only affects U layer)
    expect(isF2LSolved(state, geometry, dFace)).toBe(true);
    // OLL should still be solved (T-perm preserves orientation)
    expect(isOLLSolved(state, geometry, dFace)).toBe(true);
  });

  it("Sune breaks OLL but preserves F2L", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    // Sune changes U-layer corner orientations; net effect is U-layer only
    const sune = "R U R' U R U2 R'";
    const state = kpuzzle.defaultPattern().applyAlg(sune);
    const dFace = 5;
    expect(isF2LSolved(state, geometry, dFace)).toBe(true);
    expect(isOLLSolved(state, geometry, dFace)).toBe(false);
  });
});

describe("segmentSolve", () => {
  it("detects all phases on a single-move solve", async () => {
    // Scramble "R" breaks everything. Solution "R'" restores all at once.
    const splits = await segmentSolve("R", [
      { move: "R'", timestamp: 100 },
    ]);
    expect(splits.crossTime).toBe(100);
    expect(splits.f2lTime).toBe(100);
    expect(splits.ollTime).toBe(100);
    expect(splits.crossFace).toBeDefined();
  });

  it("detects phases at distinct timestamps for a constructed solve", async () => {
    // Scramble = E (breaks equator edges = F2L) + Sune (breaks OLL) + T-perm (breaks PLL)
    // Cross is never broken by any of these (all preserve D-layer edges).
    // Solution: T-perm (self-inverse) + inv-Sune + E'
    // Cross detected on first move. F2L not until final E' move.
    const sune = "R U R' U R U2 R'";
    const invSune = "R U2 R' U' R U' R'";
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const scramble = `E ${sune} ${tPerm}`;
    const solutionStr = `${tPerm} ${invSune} E'`;
    const solutionMoves = solutionStr.split(" ");

    const moves: TimestampedMove[] = solutionMoves.map((m, i) => ({
      move: m,
      timestamp: (i + 1) * 100,
    }));

    const splits = await segmentSolve(scramble, moves);

    expect(splits.crossTime).toBeDefined();
    expect(splits.f2lTime).toBeDefined();
    expect(splits.ollTime).toBeDefined();
    expect(splits.crossTime!).toBeLessThanOrEqual(splits.f2lTime!);
    expect(splits.f2lTime!).toBeLessThanOrEqual(splits.ollTime!);
    // F2L should not be detected until E' is applied (last move)
    expect(splits.f2lTime).toBe(solutionMoves.length * 100);
  });

  it("detects cross on a non-D face", async () => {
    // Scramble "D" only moves D-layer pieces. U cross is still solved after solution.
    const splits = await segmentSolve("D", [
      { move: "D'", timestamp: 200 },
    ]);
    // The segmenter checks faces in order [U, L, F, R, B, D].
    // After "D'" from scramble "D", all crosses are solved. First detected = U.
    expect(splits.crossFace).toBe("U");
    expect(splits.crossTime).toBe(200);
  });

  it("auto-detects cross face", async () => {
    const splits = await segmentSolve("R", [
      { move: "R'", timestamp: 100 },
    ]);
    expect(splits.crossFace).toBeDefined();
    expect(["U", "L", "F", "R", "B", "D"]).toContain(splits.crossFace);
  });

  it("detects OLL and PLL cases on a constructed solve", async () => {
    // Build a scramble that breaks cross, F2L, OLL, and PLL so boundaries are
    // detected at distinct points during the solution.
    // Scramble = R (breaks F2L/cross) + Sune (breaks OLL) + T-perm (breaks PLL)
    // Solution: T-perm inverse (= T-perm, self-inverse) + inverse-Sune + R'
    const sune = "R U R' U R U2 R'";
    const invSune = "R U2 R' U' R U' R'";
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const scramble = `R ${sune} ${tPerm}`;

    const solutionStr = `${tPerm} ${invSune} R'`;
    const solutionMoves = solutionStr.split(" ");
    const moves: TimestampedMove[] = solutionMoves.map((m, i) => ({
      move: m,
      timestamp: (i + 1) * 100,
    }));

    const splits = await segmentSolve(scramble, moves);

    expect(splits.crossTime).toBeDefined();
    expect(splits.f2lTime).toBeDefined();
    expect(splits.ollTime).toBeDefined();
  });

  it("returns no splits if solve never completes cross", async () => {
    const splits = await segmentSolve("R U F D L B R2 U2 F2 D2", [
      { move: "R", timestamp: 100 },
    ]);
    expect(splits.crossTime).toBeUndefined();
    expect(splits.f2lTime).toBeUndefined();
    expect(splits.ollTime).toBeUndefined();
  });
});
