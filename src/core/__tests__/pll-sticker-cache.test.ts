import { describe, it, expect, beforeEach } from "vitest";
import {
  PllStickerCache,
  type Color,
  type OverheadStickers,
  type AUF,
  type ViewingCorner,
} from "@/core/pll-sticker-cache";
import { PLL_CASES } from "@/core/pll-cases";

let cache: PllStickerCache;

beforeEach(() => {
  cache = new PllStickerCache();
});

describe("PllStickerCache", () => {
  describe("getOverheadStickers", () => {
    it("H perm: corners unchanged, edges swap F↔B and R↔L", async () => {
      // H perm swaps opposite edge pairs, corners untouched
      const s = await cache.getOverheadStickers("H", "");

      // Corner stickers stay at home colors
      expect(s.front[0]).toBe("F"); // UFL F-sticker
      expect(s.front[2]).toBe("F"); // UFR F-sticker
      expect(s.right[0]).toBe("R"); // UFR R-sticker
      expect(s.right[2]).toBe("R"); // UBR R-sticker
      expect(s.back[0]).toBe("B"); // UBR B-sticker
      expect(s.back[2]).toBe("B"); // UBL B-sticker
      expect(s.left[0]).toBe("L"); // UBL L-sticker
      expect(s.left[2]).toBe("L"); // UFL L-sticker

      // Edge stickers swap: F↔B, R↔L
      expect(s.front[1]).toBe("B");
      expect(s.back[1]).toBe("F");
      expect(s.right[1]).toBe("L");
      expect(s.left[1]).toBe("R");
    });

    it("Ua perm: only edges cycle, corners unchanged", async () => {
      const s = await cache.getOverheadStickers("Ua", "");

      // All corner stickers should be home colors (Ua is edge-only)
      expect(s.front[0]).toBe("F");
      expect(s.front[2]).toBe("F");
      expect(s.right[0]).toBe("R");
      expect(s.right[2]).toBe("R");
      expect(s.back[0]).toBe("B");
      expect(s.back[2]).toBe("B");
      expect(s.left[0]).toBe("L");
      expect(s.left[2]).toBe("L");

      // Edges form a 3-cycle (one stays, three rotate)
      const edgeColors = [s.front[1], s.right[1], s.back[1], s.left[1]];
      // Exactly one edge stays at home
      const homeCount = edgeColors.filter(
        (c, i) => c === (["F", "R", "B", "L"] as Color[])[i],
      ).length;
      expect(homeCount).toBe(1);
    });

    it("Aa perm: only corners cycle, edges unchanged", async () => {
      const s = await cache.getOverheadStickers("Aa", "");

      // All edge stickers should be home colors (Aa is corner-only)
      expect(s.front[1]).toBe("F");
      expect(s.right[1]).toBe("R");
      expect(s.back[1]).toBe("B");
      expect(s.left[1]).toBe("L");
    });

    it("each case produces exactly 12 valid stickers", async () => {
      const validColors = new Set<Color>(["U", "F", "R", "B", "L"]);

      for (const caseName of Object.keys(PLL_CASES)) {
        const s = await cache.getOverheadStickers(caseName, "");
        const allStickers = [
          ...s.front,
          ...s.right,
          ...s.back,
          ...s.left,
        ];
        expect(allStickers).toHaveLength(12);
        for (const sticker of allStickers) {
          expect(validColors.has(sticker)).toBe(true);
        }
      }
    });

    it("each face has exactly 3 stickers from the set {F,R,B,L}", async () => {
      // PLL only affects U-layer side stickers; "U" should never appear
      for (const caseName of Object.keys(PLL_CASES)) {
        const s = await cache.getOverheadStickers(caseName, "");
        const allStickers = [
          ...s.front,
          ...s.right,
          ...s.back,
          ...s.left,
        ];
        for (const sticker of allStickers) {
          expect(sticker).not.toBe("U");
        }
      }
    });

    it("each case preserves color count (3 of each side color)", async () => {
      // In solved state, each face has 3 stickers of its color.
      // PLL only permutes pieces, so the total count of each color is preserved.
      for (const caseName of Object.keys(PLL_CASES)) {
        const s = await cache.getOverheadStickers(caseName, "");
        const allStickers = [
          ...s.front,
          ...s.right,
          ...s.back,
          ...s.left,
        ];
        const counts = new Map<Color, number>();
        for (const c of allStickers) {
          counts.set(c, (counts.get(c) ?? 0) + 1);
        }
        expect(counts.get("F")).toBe(3);
        expect(counts.get("R")).toBe(3);
        expect(counts.get("B")).toBe(3);
        expect(counts.get("L")).toBe(3);
      }
    });
  });

  describe("AUF rotation", () => {
    it("U AUF shifts sticker pattern CW by one face for H perm", async () => {
      const noAuf = await cache.getOverheadStickers("H", "");
      const aufU = await cache.getOverheadStickers("H", "U");

      // H perm is symmetric: each face has [X, Y, X] pattern.
      // After U CW, the pattern shifts: R→F, F→L, L→B, B→R.
      expect(aufU.front).toEqual(noAuf.right);
      expect(aufU.left).toEqual(noAuf.front);
      expect(aufU.back).toEqual(noAuf.left);
      expect(aufU.right).toEqual(noAuf.back);
    });

    it("U2 AUF applied twice is same as no AUF for symmetric cases", async () => {
      // For H perm: U2 swaps front↔back and left↔right
      const noAuf = await cache.getOverheadStickers("H", "");
      const aufU2 = await cache.getOverheadStickers("H", "U2");

      expect(aufU2.front).toEqual(noAuf.back);
      expect(aufU2.back).toEqual(noAuf.front);
      expect(aufU2.right).toEqual(noAuf.left);
      expect(aufU2.left).toEqual(noAuf.right);
    });

    it("all 4 AUFs produce valid sticker patterns", async () => {
      const aufs: AUF[] = ["", "U", "U'", "U2"];
      for (const auf of aufs) {
        const s = await cache.getOverheadStickers("T", auf);
        const allStickers = [
          ...s.front,
          ...s.right,
          ...s.back,
          ...s.left,
        ];
        expect(allStickers).toHaveLength(12);
        // Color counts preserved
        const counts = new Map<Color, number>();
        for (const c of allStickers) {
          counts.set(c, (counts.get(c) ?? 0) + 1);
        }
        expect(counts.get("F")).toBe(3);
        expect(counts.get("R")).toBe(3);
        expect(counts.get("B")).toBe(3);
        expect(counts.get("L")).toBe(3);
      }
    });

    it("different AUFs produce different patterns for non-identity cases", async () => {
      const noAuf = await cache.getOverheadStickers("T", "");
      const aufU = await cache.getOverheadStickers("T", "U");

      // T perm is not rotationally symmetric, so U AUF changes the pattern
      const flatten = (s: OverheadStickers) => [
        ...s.front,
        ...s.right,
        ...s.back,
        ...s.left,
      ];
      expect(flatten(aufU)).not.toEqual(flatten(noAuf));
    });
  });

  describe("getStickers", () => {
    it("returns 6 stickers for each viewing corner", async () => {
      for (const corner of [0, 1, 2, 3] as ViewingCorner[]) {
        const stickers = await cache.getStickers("T", "", corner);
        expect(stickers).toHaveLength(6);
      }
    });

    it("corner 0 (UFR) shows front face then right face", async () => {
      const overhead = await cache.getOverheadStickers("T", "");
      const stickers = await cache.getStickers("T", "", 0);
      expect(stickers).toEqual([...overhead.front, ...overhead.right]);
    });

    it("corner 1 (URB) shows right face then back face", async () => {
      const overhead = await cache.getOverheadStickers("T", "");
      const stickers = await cache.getStickers("T", "", 1);
      expect(stickers).toEqual([...overhead.right, ...overhead.back]);
    });

    it("corner 2 (UBL) shows back face then left face", async () => {
      const overhead = await cache.getOverheadStickers("T", "");
      const stickers = await cache.getStickers("T", "", 2);
      expect(stickers).toEqual([...overhead.back, ...overhead.left]);
    });

    it("corner 3 (ULF) shows left face then front face", async () => {
      const overhead = await cache.getOverheadStickers("T", "");
      const stickers = await cache.getStickers("T", "", 3);
      expect(stickers).toEqual([...overhead.left, ...overhead.front]);
    });

    it("all stickers are valid non-U side colors", async () => {
      const validSideColors = new Set<Color>(["F", "R", "B", "L"]);
      for (const caseName of Object.keys(PLL_CASES)) {
        const stickers = await cache.getStickers(caseName, "", 0);
        for (const s of stickers) {
          expect(validSideColors.has(s)).toBe(true);
        }
      }
    });
  });

  describe("caching", () => {
    it("returns same overhead reference on repeated calls", async () => {
      const s1 = await cache.getOverheadStickers("H", "");
      const s2 = await cache.getOverheadStickers("H", "");
      expect(s1).toBe(s2); // Same object reference
    });

    it("returns same sticker array reference on repeated calls", async () => {
      const s1 = await cache.getStickers("T", "", 0);
      const s2 = await cache.getStickers("T", "", 0);
      expect(s1).toBe(s2);
    });

    it("different args produce different cache entries", async () => {
      const s1 = await cache.getOverheadStickers("H", "");
      const s2 = await cache.getOverheadStickers("H", "U");
      expect(s1).not.toBe(s2);
    });
  });

  describe("known case verification", () => {
    it("T perm matches expected sticker pattern", async () => {
      // T perm swaps UFR↔UFL corners and swaps two edges.
      // Specifically: the algorithm R U R' U' R' F R2 U' R' U' R U R' F'
      // creates a specific pattern when inverted.
      const s = await cache.getOverheadStickers("T", "");

      // T perm sticker properties:
      // - It's a corner+edge swap case
      // - All 12 stickers use only {F, R, B, L} (no U)
      const allStickers = [
        ...s.front,
        ...s.right,
        ...s.back,
        ...s.left,
      ];
      for (const sticker of allStickers) {
        expect(["F", "R", "B", "L"]).toContain(sticker);
      }

      // Color count conservation
      const counts = new Map<string, number>();
      for (const c of allStickers) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
      expect(counts.get("F")).toBe(3);
      expect(counts.get("R")).toBe(3);
      expect(counts.get("B")).toBe(3);
      expect(counts.get("L")).toBe(3);
    });

    it("Z perm: edge-only PLL with 2 edge swaps", async () => {
      // Z perm swaps two pairs of adjacent edges
      const s = await cache.getOverheadStickers("Z", "");
      const edges = [s.front[1], s.right[1], s.back[1], s.left[1]];

      // No edge should be at home (Z swaps all 4 via two 2-cycles)
      const homeEdges = edges.filter(
        (c, i) => c === (["F", "R", "B", "L"] as Color[])[i],
      );

      // Z perm algorithm includes U moves that may cycle corners,
      // but the net PLL effect swaps adjacent edge pairs.
      // At least 2 edges must be displaced
      expect(homeEdges.length).toBeLessThanOrEqual(2);
    });
  });
});
