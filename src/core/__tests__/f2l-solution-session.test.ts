import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { Alg } from "cubing/alg";
import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import {
  F2LSolutionSession,
  selectF2LCase,
  type F2LAttemptResult,
  type F2LCaseStats,
  type F2LSessionPhase,
  type F2LSolutionStoreInterface,
} from "@/core/f2l-solution-session";
import { F2L_CASES } from "@/core/f2l-cases";

let kpuzzle: KPuzzle;
let solved: KPattern;

beforeEach(async () => {
  kpuzzle = await cube3x3x3.kpuzzle();
  solved = kpuzzle.defaultPattern();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Mock store that records calls. */
function mockStore(): F2LSolutionStoreInterface & {
  attempts: { caseName: string; time: number; moveCount: number }[];
} {
  const attempts: { caseName: string; time: number; moveCount: number }[] = [];
  return {
    attempts,
    async addAttempt(a) {
      attempts.push({ caseName: a.caseName, time: a.time, moveCount: a.moveCount });
    },
    async getAttemptsByCase() {
      return [];
    },
    async getAllAttempts() {
      return [];
    },
  };
}

/**
 * Apply a sequence of moves to a session, feeding each move with timestamps.
 * Applies moves to the session's virtual state indirectly (session tracks internally).
 */
async function feedMoves(
  session: F2LSolutionSession,
  alg: string,
  startTime: number = 100,
  moveInterval: number = 50,
): Promise<number> {
  const moves = alg.trim().split(/\s+/).filter(Boolean);
  let t = startTime;
  for (const move of moves) {
    await session.onMove(move, t);
    t += moveInterval;
  }
  return t - moveInterval; // last move timestamp
}

describe("F2LSolutionSession", () => {
  describe("phase transitions", () => {
    it("starts in idle phase", () => {
      const session = new F2LSolutionSession();
      expect(session.phase).toBe("idle");
    });

    it("transitions idle → presenting on presentCase", async () => {
      const session = new F2LSolutionSession();
      const phases: F2LSessionPhase[] = [];
      session.addPhaseListener((p) => phases.push(p));

      await session.presentCase("F2L #1");
      expect(session.phase).toBe("presenting");
      expect(phases).toContain("presenting");
    });

    it("transitions presenting → solving on first move", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1");

      const phases: F2LSessionPhase[] = [];
      session.addPhaseListener((p) => phases.push(p));

      await session.onMove("U", 1000);
      expect(phases).toContain("solving");
    });

    it("transitions solving → review when FR slot is solved", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1"); // algorithm: "U R U' R'"

      const phases: F2LSessionPhase[] = [];
      session.addPhaseListener((p) => phases.push(p));

      // Execute the canonical algorithm
      await feedMoves(session, "U R U' R'", 1000);
      expect(phases).toContain("review");
      expect(session.phase).toBe("review");
    });

    it("transitions review → idle on next()", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1");
      await feedMoves(session, "U R U' R'", 1000);
      expect(session.phase).toBe("review");

      session.next();
      expect(session.phase).toBe("idle");
    });

    it("allows review → presenting via presentCase", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1");
      await feedMoves(session, "U R U' R'", 1000);
      expect(session.phase).toBe("review");

      await session.presentCase("F2L #2");
      expect(session.phase).toBe("presenting");
    });

    it("rejects presentCase from solving phase", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1");
      await session.onMove("U", 1000); // → solving

      await session.presentCase("F2L #2"); // should be ignored
      expect(session.currentCase?.name).toBe("F2L #1");
    });

    it("throws on unknown case name", async () => {
      const session = new F2LSolutionSession();
      await expect(session.presentCase("F2L #99")).rejects.toThrow("Unknown F2L case");
    });
  });

  describe("move handling and verification", () => {
    it("applies canonical algorithm and detects FR slot solved", async () => {
      // Test several cases to confirm virtual state tracking works
      for (const caseDef of F2L_CASES.slice(0, 5)) {
        const session = new F2LSolutionSession();
        await session.presentCase(caseDef.name);
        await feedMoves(session, caseDef.algorithm, 1000);
        expect(session.phase).toBe("review");
      }
    });

    it("does not complete on partial algorithm", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1"); // "U R U' R'"

      // Only apply first 3 moves
      await feedMoves(session, "U R U'", 1000);
      expect(session.phase).toBe("solving");
    });

    it("ignores moves in idle phase", async () => {
      const session = new F2LSolutionSession();
      await session.onMove("R", 1000);
      expect(session.phase).toBe("idle");
    });

    it("ignores moves in review phase", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1");
      await feedMoves(session, "U R U' R'", 1000);
      expect(session.phase).toBe("review");

      // Additional moves should not crash or change phase
      await session.onMove("R", 5000);
      expect(session.phase).toBe("review");
    });

    it("tracks move count correctly", async () => {
      const store = mockStore();
      const session = new F2LSolutionSession(store);
      await session.presentCase("F2L #1"); // "U R U' R'" = 4 moves
      await feedMoves(session, "U R U' R'", 1000, 50);

      expect(store.attempts).toHaveLength(1);
      expect(store.attempts[0].moveCount).toBe(4);
    });
  });

  describe("timing", () => {
    it("records time from first move to completion", async () => {
      const store = mockStore();
      const session = new F2LSolutionSession(store);
      await session.presentCase("F2L #1"); // "U R U' R'"

      // 4 moves starting at t=1000 with 50ms intervals → last at 1150
      await feedMoves(session, "U R U' R'", 1000, 50);

      expect(store.attempts).toHaveLength(1);
      // time = last move timestamp - first move timestamp = 1150 - 1000 = 150
      expect(store.attempts[0].time).toBe(150);
    });
  });

  describe("result and optimality", () => {
    it("marks solve as optimal when move count <= canonical", async () => {
      const session = new F2LSolutionSession();
      const results: F2LAttemptResult[] = [];
      session.addResultListener((r) => results.push(r));

      await session.presentCase("F2L #1"); // "U R U' R'" = 4 moves
      await feedMoves(session, "U R U' R'", 1000);

      expect(results).toHaveLength(1);
      expect(results[0].optimal).toBe(true);
      expect(results[0].moveCount).toBe(4);
    });

    it("marks solve as suboptimal when more moves than canonical", async () => {
      const session = new F2LSolutionSession();
      const results: F2LAttemptResult[] = [];
      session.addResultListener((r) => results.push(r));

      // F2L #1: "U R U' R'" = 4 moves. We'll add extra moves that still solve.
      // Apply some extra U moves first, then the algorithm
      await session.presentCase("F2L #2"); // "F' U' F" = 3 moves

      // Apply a longer solution: U F' U' F U' is more moves but
      // let's use something that still solves FR slot.
      // Actually, let's just verify that move count > canonical triggers suboptimal.
      // We need to feed moves that eventually solve the slot but with extra moves.
      // Simplest: U U' then the canonical alg (6 moves vs 3 canonical)
      await feedMoves(session, "U U' F' U' F", 1000);

      expect(results).toHaveLength(1);
      expect(results[0].moveCount).toBe(5);
      expect(results[0].optimal).toBe(false);
    });

    it("exposes lastResult after completion", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1");
      expect(session.lastResult).toBeNull();

      await feedMoves(session, "U R U' R'", 1000);
      expect(session.lastResult).not.toBeNull();
      expect(session.lastResult!.caseName).toBe("F2L #1");
    });
  });

  describe("skip", () => {
    it("skips from presenting phase without recording attempt", async () => {
      const store = mockStore();
      const session = new F2LSolutionSession(store);
      await session.presentCase("F2L #1");

      session.skip();
      expect(session.phase).toBe("idle");
      expect(store.attempts).toHaveLength(0);
    });

    it("skips from solving phase without recording attempt", async () => {
      const store = mockStore();
      const session = new F2LSolutionSession(store);
      await session.presentCase("F2L #1");
      await session.onMove("U", 1000); // → solving

      session.skip();
      expect(session.phase).toBe("idle");
      expect(store.attempts).toHaveLength(0);
    });

    it("skip is no-op in idle phase", () => {
      const session = new F2LSolutionSession();
      session.skip();
      expect(session.phase).toBe("idle");
    });

    it("skip is no-op in review phase", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1");
      await feedMoves(session, "U R U' R'", 1000);

      session.skip();
      expect(session.phase).toBe("review");
    });
  });

  describe("auto-advance on optimal", () => {
    it("auto-advances to idle after 2s on optimal solve", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1"); // 4-move alg
      await feedMoves(session, "U R U' R'", 1000);
      expect(session.phase).toBe("review");

      // Advance timers by 2s
      vi.advanceTimersByTime(2000);
      expect(session.phase).toBe("idle");
    });

    it("does not auto-advance on suboptimal solve", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #2"); // "F' U' F" = 3 moves

      // Feed extra moves to make it suboptimal
      await feedMoves(session, "U U' F' U' F", 1000);
      expect(session.phase).toBe("review");

      vi.advanceTimersByTime(5000);
      expect(session.phase).toBe("review"); // still in review
    });

    it("cancels auto-advance on manual next()", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1");
      await feedMoves(session, "U R U' R'", 1000);

      const phases: F2LSessionPhase[] = [];
      session.addPhaseListener((p) => phases.push(p));

      session.next(); // manual advance
      expect(session.phase).toBe("idle");

      // Timer fires but should do nothing
      vi.advanceTimersByTime(2000);
      // Should only have the one idle transition from next()
      expect(phases.filter((p) => p === "idle")).toHaveLength(1);
    });

    it("cancels auto-advance when new case is presented", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1");
      await feedMoves(session, "U R U' R'", 1000);

      await session.presentCase("F2L #2"); // clears auto-advance
      expect(session.phase).toBe("presenting");

      vi.advanceTimersByTime(2000);
      expect(session.phase).toBe("presenting"); // not idle
    });
  });

  describe("case state computation", () => {
    it("computes case state as inverse of canonical algorithm", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1"); // "U R U' R'"

      // The case state should be: solved.applyAlg(inverse("U R U' R'"))
      // = solved.applyAlg("R U R' U'")
      const expected = solved.applyAlg(
        new Alg("U R U' R'").invert().toString(),
      );
      expect(session.caseState!.isIdentical(expected)).toBe(true);
    });
  });

  describe("listeners", () => {
    it("phase listener receives all transitions", async () => {
      const session = new F2LSolutionSession();
      const phases: F2LSessionPhase[] = [];
      session.addPhaseListener((p) => phases.push(p));

      await session.presentCase("F2L #1");
      await feedMoves(session, "U R U' R'", 1000);
      session.next();

      expect(phases).toEqual(["presenting", "solving", "review", "idle"]);
    });

    it("result listener receives completion", async () => {
      const session = new F2LSolutionSession();
      const results: F2LAttemptResult[] = [];
      session.addResultListener((r) => results.push(r));

      await session.presentCase("F2L #1");
      await feedMoves(session, "U R U' R'", 1000);

      expect(results).toHaveLength(1);
      expect(results[0].caseName).toBe("F2L #1");
    });

    it("can remove listeners", async () => {
      const session = new F2LSolutionSession();
      const phases: F2LSessionPhase[] = [];
      const listener = (p: F2LSessionPhase) => phases.push(p);
      session.addPhaseListener(listener);
      session.removePhaseListener(listener);

      await session.presentCase("F2L #1");
      expect(phases).toHaveLength(0);
    });
  });

  describe("reset", () => {
    it("resets to idle and clears all state", async () => {
      const session = new F2LSolutionSession();
      await session.presentCase("F2L #1");
      await session.onMove("U", 1000);

      session.reset();
      expect(session.phase).toBe("idle");
      expect(session.currentCase).toBeNull();
      expect(session.caseState).toBeNull();
      expect(session.lastResult).toBeNull();
    });
  });
});

describe("selectF2LCase", () => {
  it("returns an unattempted case when some exist", () => {
    const stats: F2LCaseStats[] = [
      { caseName: "F2L #1", attemptCount: 5, top5AvgTime: 2000 },
      // F2L #2 through #41 are not in stats → unattempted
    ];

    // Run multiple times to confirm it always picks unattempted
    for (let i = 0; i < 20; i++) {
      const selected = selectF2LCase(stats);
      expect(selected).not.toBe("F2L #1");
    }
  });

  it("returns a case from all when stats is empty", () => {
    const selected = selectF2LCase([]);
    expect(selected).toMatch(/^F2L #\d+$/);
  });

  it("weights slower cases higher when all are attempted", () => {
    // Create stats for all 41 cases
    const stats: F2LCaseStats[] = F2L_CASES.map((c, i) => ({
      caseName: c.name,
      attemptCount: 10,
      top5AvgTime: i === 0 ? 10000 : 1000, // F2L #1 is much slower
    }));

    // Run many trials, F2L #1 should be selected more often
    const counts = new Map<string, number>();
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const selected = selectF2LCase(stats);
      counts.set(selected, (counts.get(selected) ?? 0) + 1);
    }

    const f2l1Count = counts.get("F2L #1") ?? 0;
    const avgOtherCount =
      (trials - f2l1Count) / (F2L_CASES.length - 1);

    // F2L #1 should be selected significantly more than average
    expect(f2l1Count).toBeGreaterThan(avgOtherCount * 2);
  });
});
