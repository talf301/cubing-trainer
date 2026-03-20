import { describe, it, expect } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { buildFaceGeometry } from "../cfop-segmenter";

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
