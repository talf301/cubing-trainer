import { describe, expect, it, vi } from "vitest";
import { PllCaseSelector, type PllCaseWeight } from "../pll-case-selector";

function makeCase(
  overrides: Partial<PllCaseWeight> & { caseName: string },
): PllCaseWeight {
  return {
    attemptCount: 10,
    avgTime: 3000,
    bestTime: 2500,
    twoLookRate: 0,
    lastAttemptAt: Date.now() - 60_000,
    ...overrides,
  };
}

const NOW = 1_700_000_000_000;

describe("PllCaseSelector", () => {
  const selector = new PllCaseSelector();

  describe("edge cases", () => {
    it("returns null when known list is empty", () => {
      expect(selector.select([], NOW)).toBeNull();
    });

    it("returns the single case when only one is known", () => {
      const cases = [makeCase({ caseName: "T" })];
      expect(selector.select(cases, NOW)).toBe("T");
    });
  });

  describe("slower cases get higher weight", () => {
    it("favors the slower case", () => {
      const fast = makeCase({
        caseName: "T",
        avgTime: 1000,
        attemptCount: 50,
        twoLookRate: 0,
        lastAttemptAt: NOW - 1000,
      });
      const slow = makeCase({
        caseName: "V",
        avgTime: 5000,
        attemptCount: 50,
        twoLookRate: 0,
        lastAttemptAt: NOW - 1000,
      });
      const cases = [fast, slow];

      const wFast = selector.computeWeight(fast, cases, NOW);
      const wSlow = selector.computeWeight(slow, cases, NOW);
      expect(wSlow).toBeGreaterThan(wFast);
    });
  });

  describe("less practiced cases favored", () => {
    it("gives higher weight to case with fewer attempts", () => {
      const practiced = makeCase({
        caseName: "T",
        avgTime: 3000,
        attemptCount: 100,
        twoLookRate: 0,
        lastAttemptAt: NOW - 1000,
      });
      const unpracticed = makeCase({
        caseName: "V",
        avgTime: 3000,
        attemptCount: 2,
        twoLookRate: 0,
        lastAttemptAt: NOW - 1000,
      });
      const cases = [practiced, unpracticed];

      const wPracticed = selector.computeWeight(practiced, cases, NOW);
      const wUnpracticed = selector.computeWeight(unpracticed, cases, NOW);
      expect(wUnpracticed).toBeGreaterThan(wPracticed);
    });
  });

  describe("high 2-look rate increases weight", () => {
    it("favors cases with higher 2-look rate", () => {
      const clean = makeCase({
        caseName: "T",
        avgTime: 3000,
        attemptCount: 50,
        twoLookRate: 0,
        lastAttemptAt: NOW - 1000,
      });
      const twoLooky = makeCase({
        caseName: "V",
        avgTime: 3000,
        attemptCount: 50,
        twoLookRate: 0.8,
        lastAttemptAt: NOW - 1000,
      });
      const cases = [clean, twoLooky];

      const wClean = selector.computeWeight(clean, cases, NOW);
      const wTwoLooky = selector.computeWeight(twoLooky, cases, NOW);
      expect(wTwoLooky).toBeGreaterThan(wClean);
    });
  });

  describe("staleness bonus", () => {
    it("favors cases not drilled recently", () => {
      const recent = makeCase({
        caseName: "T",
        avgTime: 3000,
        attemptCount: 50,
        twoLookRate: 0,
        lastAttemptAt: NOW - 60_000, // 1 min ago
      });
      const stale = makeCase({
        caseName: "V",
        avgTime: 3000,
        attemptCount: 50,
        twoLookRate: 0,
        lastAttemptAt: NOW - 86_400_000, // 1 day ago
      });
      const cases = [recent, stale];

      const wRecent = selector.computeWeight(recent, cases, NOW);
      const wStale = selector.computeWeight(stale, cases, NOW);
      expect(wStale).toBeGreaterThan(wRecent);
    });

    it("gives max staleness to never-attempted cases", () => {
      const attempted = makeCase({
        caseName: "T",
        avgTime: 3000,
        attemptCount: 50,
        twoLookRate: 0,
        lastAttemptAt: NOW - 1000,
      });
      const never = makeCase({
        caseName: "V",
        attemptCount: 0,
        avgTime: 0,
        bestTime: 0,
        twoLookRate: 0,
        lastAttemptAt: 0,
      });
      const cases = [attempted, never];

      const wAttempted = selector.computeWeight(attempted, cases, NOW);
      const wNever = selector.computeWeight(never, cases, NOW);
      expect(wNever).toBeGreaterThan(wAttempted);
    });
  });

  describe("weighted random selection", () => {
    it("returns one of the known cases", () => {
      const cases = [
        makeCase({ caseName: "T", avgTime: 2000 }),
        makeCase({ caseName: "V", avgTime: 4000 }),
        makeCase({ caseName: "Y", avgTime: 3000 }),
      ];

      const result = selector.select(cases, NOW);
      expect(["T", "V", "Y"]).toContain(result);
    });

    it("with extreme weights, heavily favors the weighted case", () => {
      // One case is slow, unpracticed, 2-looky, and stale
      const easy = makeCase({
        caseName: "T",
        avgTime: 1000,
        attemptCount: 200,
        twoLookRate: 0,
        lastAttemptAt: NOW - 1000,
      });
      const hard = makeCase({
        caseName: "V",
        avgTime: 10000,
        attemptCount: 1,
        twoLookRate: 1.0,
        lastAttemptAt: NOW - 86_400_000 * 30,
      });
      const cases = [easy, hard];

      // Run many selections and check distribution
      const counts: Record<string, number> = { T: 0, V: 0 };
      const mockRandom = vi.spyOn(Math, "random");
      for (let i = 0; i < 100; i++) {
        mockRandom.mockReturnValue(i / 100);
        const result = selector.select(cases, NOW)!;
        counts[result]++;
      }
      mockRandom.mockRestore();

      // "V" should be picked much more often
      expect(counts["V"]).toBeGreaterThan(counts["T"]);
    });
  });

  describe("cases with no attempts", () => {
    it("treats unattempted cases as max avg time (1.0 normalized)", () => {
      const attempted = makeCase({
        caseName: "T",
        avgTime: 2000,
        attemptCount: 20,
        twoLookRate: 0,
        lastAttemptAt: NOW - 1000,
      });
      const unattempted = makeCase({
        caseName: "V",
        attemptCount: 0,
        avgTime: 0,
        bestTime: 0,
        twoLookRate: 0,
        lastAttemptAt: 0,
      });
      const cases = [attempted, unattempted];

      // Unattempted should have higher weight (max avg time + max staleness + high attempt score)
      const wAttempted = selector.computeWeight(attempted, cases, NOW);
      const wUnattempted = selector.computeWeight(unattempted, cases, NOW);
      expect(wUnattempted).toBeGreaterThan(wAttempted);
    });
  });
});
