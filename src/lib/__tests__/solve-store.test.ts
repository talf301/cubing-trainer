import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import FDBFactory from "fake-indexeddb/lib/FDBFactory";
import { SolveStore, type StoredSolve } from "@/lib/solve-store";
import { resetDB } from "@/lib/db";

function makeSolve(overrides: Partial<StoredSolve> = {}): StoredSolve {
  return {
    id: crypto.randomUUID(),
    scramble: "R U R' U'",
    moves: [
      { move: "U", timestamp: 0 },
      { move: "R", timestamp: 200 },
      { move: "U'", timestamp: 400 },
      { move: "R'", timestamp: 600 },
    ],
    startTime: 1000,
    endTime: 1600,
    duration: 600,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("SolveStore", () => {
  let store: SolveStore;

  beforeEach(() => {
    // Replace the global indexedDB with a fresh instance so each test
    // gets an empty database, then reset the cached DB promise.
    globalThis.indexedDB = new FDBFactory();
    resetDB();
    store = new SolveStore();
  });

  it("saves and retrieves a solve", async () => {
    const solve = makeSolve();
    await store.save(solve);
    const all = await store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(solve.id);
    expect(all[0].scramble).toBe("R U R' U'");
  });

  it("returns solves in reverse chronological order", async () => {
    const s1 = makeSolve({ createdAt: 1000 });
    const s2 = makeSolve({ createdAt: 2000 });
    const s3 = makeSolve({ createdAt: 3000 });
    await store.save(s1);
    await store.save(s2);
    await store.save(s3);

    const all = await store.getAll();
    expect(all[0].createdAt).toBe(3000);
    expect(all[2].createdAt).toBe(1000);
  });

  it("retrieves a solve by id", async () => {
    const solve = makeSolve();
    await store.save(solve);
    const retrieved = await store.getById(solve.id);
    expect(retrieved?.id).toBe(solve.id);
  });

  it("returns undefined for non-existent id", async () => {
    const result = await store.getById("nonexistent");
    expect(result).toBeUndefined();
  });
});
