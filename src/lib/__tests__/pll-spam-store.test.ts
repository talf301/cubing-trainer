import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
// @ts-expect-error — fake-indexeddb exports types but package.json "exports" doesn't resolve them
import FDBFactory from "fake-indexeddb/lib/FDBFactory";
import { PllSpamStore, type PllSpamAttempt } from "@/lib/pll-spam-store";
import { resetDB } from "@/lib/db";

function makeAttempt(overrides: Partial<PllSpamAttempt> = {}): PllSpamAttempt {
  return {
    id: crypto.randomUUID(),
    caseName: "T",
    time: 2500,
    moveCount: 14,
    timestamp: Date.now(),
    ...overrides,
  };
}

describe("PllSpamStore", () => {
  let store: PllSpamStore;

  beforeEach(() => {
    globalThis.indexedDB = new FDBFactory();
    resetDB();
    store = new PllSpamStore();
  });

  describe("addAttempt", () => {
    it("stores and retrieves an attempt", async () => {
      const attempt = makeAttempt({ caseName: "Aa" });
      await store.addAttempt(attempt);
      const all = await store.getAllAttempts();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe(attempt.id);
      expect(all[0].caseName).toBe("Aa");
      expect(all[0].time).toBe(2500);
      expect(all[0].moveCount).toBe(14);
    });

    it("overwrites an attempt with the same id", async () => {
      const attempt = makeAttempt({ caseName: "T", time: 2000 });
      await store.addAttempt(attempt);
      await store.addAttempt({ ...attempt, time: 1500 });
      const all = await store.getAllAttempts();
      expect(all).toHaveLength(1);
      expect(all[0].time).toBe(1500);
    });
  });

  describe("getAttemptsByCase", () => {
    it("returns only attempts for the specified case", async () => {
      await store.addAttempt(makeAttempt({ caseName: "T" }));
      await store.addAttempt(makeAttempt({ caseName: "T" }));
      await store.addAttempt(makeAttempt({ caseName: "Jb" }));

      const tAttempts = await store.getAttemptsByCase("T");
      expect(tAttempts).toHaveLength(2);

      const jbAttempts = await store.getAttemptsByCase("Jb");
      expect(jbAttempts).toHaveLength(1);
    });

    it("returns empty array for a case with no attempts", async () => {
      const attempts = await store.getAttemptsByCase("Z");
      expect(attempts).toHaveLength(0);
    });
  });

  describe("getAllAttempts", () => {
    it("returns all attempts across all cases", async () => {
      await store.addAttempt(makeAttempt({ caseName: "T" }));
      await store.addAttempt(makeAttempt({ caseName: "Aa" }));
      await store.addAttempt(makeAttempt({ caseName: "Jb" }));

      const all = await store.getAllAttempts();
      expect(all).toHaveLength(3);
      const names = all.map((a) => a.caseName);
      expect(names).toContain("T");
      expect(names).toContain("Aa");
      expect(names).toContain("Jb");
    });

    it("returns empty array when no attempts exist", async () => {
      const all = await store.getAllAttempts();
      expect(all).toHaveLength(0);
    });
  });
});
