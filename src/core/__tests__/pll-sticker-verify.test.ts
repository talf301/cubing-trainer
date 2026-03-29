import { describe, it, expect } from "vitest";
import { PllStickerCache } from "@/core/pll-sticker-cache";

describe("PLL sticker verification", () => {
  const cache = new PllStickerCache();

  it("T-perm has headlights on two opposite faces, no fully solved face", async () => {
    const s = await cache.getOverheadStickers("T", "");

    const faces = [s.front, s.right, s.back, s.left];
    const solvedFaces = faces.filter(
      (f) => f[0] === f[1] && f[1] === f[2],
    );
    expect(solvedFaces.length).toBe(0);

    const hasHeadlights = (f: readonly string[]) =>
      (f[0] === f[1] && f[1] !== f[2]) ||
      (f[0] === f[2] && f[0] !== f[1]) ||
      (f[1] === f[2] && f[0] !== f[1]);
    const headlightFaces = faces.filter(hasHeadlights);
    expect(headlightFaces.length).toBeGreaterThanOrEqual(2);
  });

  it("F-perm has exactly one fully solved face", async () => {
    const s = await cache.getOverheadStickers("F", "");

    const faces = [s.front, s.right, s.back, s.left];
    const solvedFaces = faces.filter(
      (f) => f[0] === f[1] && f[1] === f[2],
    );
    expect(solvedFaces.length).toBe(1);
  });
});
