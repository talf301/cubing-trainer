import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
// @ts-expect-error — fake-indexeddb exports types but package.json "exports" doesn't resolve them
import FDBFactory from "fake-indexeddb/lib/FDBFactory";
import { PllStatsStore, type PllAttempt } from "@/lib/pll-stats-store";
import { resetDB } from "@/lib/db";

function makeAttempt(overrides: Partial<PllAttempt> = {}): PllAttempt {
  return {
    id: crypto.randomUUID(),
    caseName: "T",
    time: 2500,
    moveCount: 14,
    was2Look: false,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("PllStatsStore", () => {
  let store: PllStatsStore;

  beforeEach(() => {
    globalThis.indexedDB = new FDBFactory();
    resetDB();
    store = new PllStatsStore();
  });

  describe("known cases CRUD", () => {
    it("starts with no known cases", async () => {
      const cases = await store.getKnownCases();
      expect(cases).toHaveLength(0);
    });

    it("adds a known case", async () => {
      await store.addKnownCase("T");
      const cases = await store.getKnownCases();
      expect(cases).toHaveLength(1);
      expect(cases[0].name).toBe("T");
      expect(cases[0].addedAt).toBeGreaterThan(0);
    });

    it("adding the same case twice overwrites without duplicating", async () => {
      await store.addKnownCase("T");
      await store.addKnownCase("T");
      const cases = await store.getKnownCases();
      expect(cases).toHaveLength(1);
    });

    it("removes a known case", async () => {
      await store.addKnownCase("T");
      await store.addKnownCase("Aa");
      await store.removeKnownCase("T");
      const cases = await store.getKnownCases();
      expect(cases).toHaveLength(1);
      expect(cases[0].name).toBe("Aa");
    });

    it("removing a non-existent case does not throw", async () => {
      await expect(store.removeKnownCase("Z")).resolves.toBeUndefined();
    });
  });

  describe("recording attempts", () => {
    it("records and retrieves an attempt", async () => {
      const attempt = makeAttempt({ caseName: "Aa" });
      await store.recordAttempt(attempt);
      const attempts = await store.getAttemptsForCase("Aa");
      expect(attempts).toHaveLength(1);
      expect(attempts[0].id).toBe(attempt.id);
      expect(attempts[0].caseName).toBe("Aa");
    });

    it("retrieves only attempts for the specified case", async () => {
      await store.recordAttempt(makeAttempt({ caseName: "T" }));
      await store.recordAttempt(makeAttempt({ caseName: "T" }));
      await store.recordAttempt(makeAttempt({ caseName: "Jb" }));

      const tAttempts = await store.getAttemptsForCase("T");
      expect(tAttempts).toHaveLength(2);

      const jbAttempts = await store.getAttemptsForCase("Jb");
      expect(jbAttempts).toHaveLength(1);
    });
  });

  describe("stats aggregation", () => {
    it("returns null for a case with no attempts", async () => {
      const stats = await store.getStatsForCase("T");
      expect(stats).toBeNull();
    });

    it("computes correct stats for a single attempt", async () => {
      await store.recordAttempt(
        makeAttempt({ caseName: "T", time: 3000, was2Look: false }),
      );
      const stats = await store.getStatsForCase("T");
      expect(stats).not.toBeNull();
      expect(stats!.caseName).toBe("T");
      expect(stats!.attemptCount).toBe(1);
      expect(stats!.avgTime).toBe(3000);
      expect(stats!.bestTime).toBe(3000);
      expect(stats!.twoLookRate).toBe(0);
    });

    it("computes avg time, best time, and attempt count across multiple attempts", async () => {
      await store.recordAttempt(makeAttempt({ caseName: "T", time: 2000 }));
      await store.recordAttempt(makeAttempt({ caseName: "T", time: 3000 }));
      await store.recordAttempt(makeAttempt({ caseName: "T", time: 4000 }));

      const stats = await store.getStatsForCase("T");
      expect(stats!.attemptCount).toBe(3);
      expect(stats!.avgTime).toBe(3000);
      expect(stats!.bestTime).toBe(2000);
    });

    it("computes 2-look rate correctly", async () => {
      await store.recordAttempt(
        makeAttempt({ caseName: "Aa", time: 2000, was2Look: true }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "Aa", time: 2500, was2Look: false }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "Aa", time: 3000, was2Look: true }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "Aa", time: 2200, was2Look: false }),
      );

      const stats = await store.getStatsForCase("Aa");
      expect(stats!.twoLookRate).toBe(0.5);
    });
  });

  describe("getAllStats", () => {
    it("returns stats for all known cases", async () => {
      await store.addKnownCase("T");
      await store.addKnownCase("Aa");
      await store.recordAttempt(makeAttempt({ caseName: "T", time: 2000 }));
      await store.recordAttempt(makeAttempt({ caseName: "Aa", time: 3000 }));

      const allStats = await store.getAllStats();
      expect(allStats).toHaveLength(2);
      const names = allStats.map((s) => s.caseName);
      expect(names).toContain("T");
      expect(names).toContain("Aa");
    });

    it("includes known cases with no attempts as zeroed stats", async () => {
      await store.addKnownCase("F");

      const allStats = await store.getAllStats();
      expect(allStats).toHaveLength(1);
      expect(allStats[0].caseName).toBe("F");
      expect(allStats[0].attemptCount).toBe(0);
      expect(allStats[0].avgTime).toBe(0);
      expect(allStats[0].bestTime).toBe(0);
      expect(allStats[0].twoLookRate).toBe(0);
    });

    it("does not include attempts for cases not in known list", async () => {
      await store.addKnownCase("T");
      await store.recordAttempt(makeAttempt({ caseName: "T", time: 2000 }));
      await store.recordAttempt(makeAttempt({ caseName: "Jb", time: 3000 }));

      const allStats = await store.getAllStats();
      expect(allStats).toHaveLength(1);
      expect(allStats[0].caseName).toBe("T");
    });
  });
});
