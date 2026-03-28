import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
// @ts-expect-error — fake-indexeddb exports types but package.json "exports" doesn't resolve them
import FDBFactory from "fake-indexeddb/lib/FDBFactory";
import {
  PllRecognitionStatsStore,
  type PllRecognitionAttempt,
} from "@/lib/pll-recognition-stats-store";
import { resetDB } from "@/lib/db";

function makeAttempt(
  overrides: Partial<PllRecognitionAttempt> = {},
): PllRecognitionAttempt {
  return {
    id: crypto.randomUUID(),
    caseName: "T",
    viewingCorner: 0,
    auf: 0,
    correct: true,
    answerGiven: "T",
    distractors: ["Aa", "Ab", "F", "Ga", "Gb"],
    recognitionTime: 1500,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("PllRecognitionStatsStore", () => {
  let store: PllRecognitionStatsStore;

  beforeEach(() => {
    globalThis.indexedDB = new FDBFactory();
    resetDB();
    store = new PllRecognitionStatsStore();
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

    it("stores all recognition-specific fields", async () => {
      const attempt = makeAttempt({
        caseName: "F",
        viewingCorner: 2,
        auf: 3,
        correct: false,
        answerGiven: "Ga",
        distractors: ["T", "Aa", "Ab", "Gb", "Gc"],
        recognitionTime: 3200,
      });
      await store.recordAttempt(attempt);
      const attempts = await store.getAttemptsForCase("F");
      expect(attempts[0].viewingCorner).toBe(2);
      expect(attempts[0].auf).toBe(3);
      expect(attempts[0].correct).toBe(false);
      expect(attempts[0].answerGiven).toBe("Ga");
      expect(attempts[0].distractors).toEqual([
        "T",
        "Aa",
        "Ab",
        "Gb",
        "Gc",
      ]);
      expect(attempts[0].recognitionTime).toBe(3200);
    });
  });

  describe("stats aggregation", () => {
    it("returns null for a case with no attempts", async () => {
      const stats = await store.getStatsForCase("T");
      expect(stats).toBeNull();
    });

    it("computes correct stats for a single correct attempt", async () => {
      await store.recordAttempt(
        makeAttempt({
          caseName: "T",
          correct: true,
          recognitionTime: 2000,
          timestamp: 1000,
        }),
      );
      const stats = await store.getStatsForCase("T");
      expect(stats).not.toBeNull();
      expect(stats!.caseName).toBe("T");
      expect(stats!.attemptCount).toBe(1);
      expect(stats!.accuracy).toBe(1);
      expect(stats!.avgTime).toBe(2000);
      expect(stats!.lastAttemptAt).toBe(1000);
    });

    it("computes accuracy across multiple attempts", async () => {
      await store.recordAttempt(
        makeAttempt({ caseName: "Aa", correct: true }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "Aa", correct: false, answerGiven: "Ab" }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "Aa", correct: true }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "Aa", correct: false, answerGiven: "T" }),
      );

      const stats = await store.getStatsForCase("Aa");
      expect(stats!.attemptCount).toBe(4);
      expect(stats!.accuracy).toBe(0.5);
    });

    it("computes average recognition time", async () => {
      await store.recordAttempt(
        makeAttempt({ caseName: "T", recognitionTime: 1000 }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "T", recognitionTime: 2000 }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "T", recognitionTime: 3000 }),
      );

      const stats = await store.getStatsForCase("T");
      expect(stats!.avgTime).toBe(2000);
    });

    it("tracks lastAttemptAt as the most recent timestamp", async () => {
      await store.recordAttempt(
        makeAttempt({ caseName: "T", timestamp: 100 }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "T", timestamp: 300 }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "T", timestamp: 200 }),
      );

      const stats = await store.getStatsForCase("T");
      expect(stats!.lastAttemptAt).toBe(300);
    });
  });

  describe("getAllStats", () => {
    it("returns stats for all cases with attempts", async () => {
      await store.recordAttempt(
        makeAttempt({ caseName: "T", recognitionTime: 1500 }),
      );
      await store.recordAttempt(
        makeAttempt({ caseName: "Aa", recognitionTime: 2500 }),
      );

      const allStats = await store.getAllStats();
      expect(allStats).toHaveLength(2);
      const names = allStats.map((s) => s.caseName);
      expect(names).toContain("T");
      expect(names).toContain("Aa");
    });

    it("returns empty array when no attempts exist", async () => {
      const allStats = await store.getAllStats();
      expect(allStats).toHaveLength(0);
    });

    it("computes correct stats per case in getAllStats", async () => {
      await store.recordAttempt(
        makeAttempt({
          caseName: "T",
          correct: true,
          recognitionTime: 1000,
        }),
      );
      await store.recordAttempt(
        makeAttempt({
          caseName: "T",
          correct: false,
          answerGiven: "Aa",
          recognitionTime: 3000,
        }),
      );
      await store.recordAttempt(
        makeAttempt({
          caseName: "Aa",
          correct: true,
          recognitionTime: 2000,
        }),
      );

      const allStats = await store.getAllStats();
      const tStats = allStats.find((s) => s.caseName === "T")!;
      expect(tStats.attemptCount).toBe(2);
      expect(tStats.accuracy).toBe(0.5);
      expect(tStats.avgTime).toBe(2000);

      const aaStats = allStats.find((s) => s.caseName === "Aa")!;
      expect(aaStats.attemptCount).toBe(1);
      expect(aaStats.accuracy).toBe(1);
      expect(aaStats.avgTime).toBe(2000);
    });
  });
});
