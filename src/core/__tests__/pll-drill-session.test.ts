import { describe, it, expect, vi, beforeEach } from "vitest";
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import {
  PllDrillSession,
  type DrillPhase,
  type PllCaseSelectorInterface,
} from "@/core/pll-drill-session";
import type { PllStatsStore, PllKnownCase } from "@/lib/pll-stats-store";
import { PLL_CASES } from "@/core/pll-cases";

// --- Mocks ---

function createMockStatsStore(
  knownCases: string[] = [],
): PllStatsStore {
  return {
    getKnownCases: vi.fn(async () =>
      knownCases.map((name) => ({ name, addedAt: Date.now() }) as PllKnownCase),
    ),
    addKnownCase: vi.fn(async () => {}),
    removeKnownCase: vi.fn(async () => {}),
    recordAttempt: vi.fn(async () => {}),
    getAttemptsForCase: vi.fn(async () => []),
    getStatsForCase: vi.fn(async () => null),
    getAllStats: vi.fn(async () => []),
  } as unknown as PllStatsStore;
}

function createMockSelector(caseName: string): PllCaseSelectorInterface {
  return {
    selectCase: vi.fn(async () => caseName),
  };
}

let kpuzzle: KPuzzle;
let solved: KPattern;

beforeEach(async () => {
  kpuzzle = await cube3x3x3.kpuzzle();
  solved = kpuzzle.defaultPattern();
});

/**
 * Helper: advance a session through selecting → scrambling → ready.
 * Returns the scrambled state so tests can apply solve moves.
 */
async function advanceToReady(
  session: PllDrillSession,
): Promise<KPattern> {
  await session.startNextCase();
  // Apply the scramble to get expected state
  const scrambledState = solved.applyAlg(session.scramble);
  session.onCubeState(scrambledState);
  expect(session.phase).toBe("ready");
  return scrambledState;
}

describe("PllDrillSession", () => {
  it("starts in idle phase", () => {
    const store = createMockStatsStore();
    const selector = createMockSelector("T");
    const session = new PllDrillSession(store, selector);
    expect(session.phase).toBe("idle");
  });

  describe("full lifecycle", () => {
    it("transitions idle → selecting → scrambling → ready → solving → review", async () => {
      const store = createMockStatsStore(["T"]);
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      const phases: DrillPhase[] = [];
      session.addPhaseListener((phase) => phases.push(phase));

      // idle → selecting → scrambling
      await session.startNextCase();
      expect(phases).toContain("selecting");
      expect(phases).toContain("scrambling");
      expect(session.phase).toBe("scrambling");
      expect(session.currentCase).toBe("T");
      expect(session.scramble.length).toBeGreaterThan(0);

      // scrambling → ready
      const scrambledState = solved.applyAlg(session.scramble);
      session.onCubeState(scrambledState);
      expect(session.phase).toBe("ready");

      // ready → solving → review: apply inverse of scramble to solve
      const solveAlg = new Alg(session.scramble).invert();
      let state = scrambledState;
      let time = 1000;
      for (const moveNode of solveAlg.childAlgNodes()) {
        const moveStr = moveNode.toString();
        time += 100;
        state = state.applyAlg(moveStr);
        await session.onMove(moveStr, time, state);
      }

      expect(session.phase).toBe("review");
    });

    it("loops from review back to selecting on startNextCase", async () => {
      const store = createMockStatsStore(["T"]);
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      // Get to review state
      await session.startNextCase();
      const scrambledState = solved.applyAlg(session.scramble);
      session.onCubeState(scrambledState);

      // Solve it: apply inverse of scramble
      const solveAlg = new Alg(session.scramble).invert();
      let state = scrambledState;
      let time = 1000;
      for (const moveNode of solveAlg.childAlgNodes()) {
        time += 100;
        state = state.applyAlg(moveNode.toString());
        await session.onMove(moveNode.toString(), time, state);
      }
      expect(session.phase).toBe("review");

      // Start next case from review
      await session.startNextCase();
      expect(session.phase).toBe("scrambling");
    });
  });

  describe("scramble generation", () => {
    it("produces a valid PLL state (only PLL unsolved)", async () => {
      const store = createMockStatsStore();
      const selector = createMockSelector("Jb");
      const session = new PllDrillSession(store, selector);

      await session.startNextCase();

      const scrambledState = solved.applyAlg(session.scramble);

      // Cross, F2L, and OLL should all be solved.
      // Only the U-layer permutation should differ.
      // Check that the scrambled state is NOT fully solved
      const isSolved = scrambledState.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      });
      expect(isSolved).toBe(false);

      // Check that applying the correct PLL algorithm (with possible AUF) solves it
      const jbAlg = PLL_CASES["Jb"].algorithm;

      // Try all 4 AUF pre-rotations to find the one that works
      let solvedAfterAlg = false;
      for (const auf of ["", "U", "U'", "U2"]) {
        let testState = auf ? scrambledState.applyAlg(auf) : scrambledState;
        testState = testState.applyAlg(jbAlg);

        // Check with each post-AUF
        for (const postAuf of ["", "U", "U'", "U2"]) {
          const finalState = postAuf
            ? testState.applyAlg(postAuf)
            : testState;
          if (
            finalState.experimentalIsSolved({
              ignorePuzzleOrientation: true,
              ignoreCenterOrientation: true,
            })
          ) {
            solvedAfterAlg = true;
            break;
          }
        }
        if (solvedAfterAlg) break;
      }

      expect(solvedAfterAlg).toBe(true);
    });

    it("generates scramble with AUF variation", async () => {
      // Run multiple times to check scrambles vary (probabilistic)
      const store = createMockStatsStore();
      const selector = createMockSelector("Ua");
      const scrambles = new Set<string>();

      for (let i = 0; i < 20; i++) {
        const session = new PllDrillSession(store, selector);
        await session.startNextCase();
        scrambles.add(session.scramble);
      }

      // With 4 * 4 = 16 possible AUF combos, 20 trials should produce >1 unique scramble
      expect(scrambles.size).toBeGreaterThan(1);
    });
  });

  describe("2-look detection", () => {
    it("flags 2-look when known case is solved via corners then edges", async () => {
      // Use a case that's not a corner-only or edge-only PLL
      // T perm: corners [1,0,2,3], edges [0,3,2,1]
      const store = createMockStatsStore(["T"]);
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      await session.startNextCase();
      const scrambledState = solved.applyAlg(session.scramble);
      session.onCubeState(scrambledState);

      // Simulate 2-look: first solve corners with a corner-swap alg,
      // leaving only an edge permutation.
      // We'll construct a state manually: apply an edge-only PLL to solved
      // This simulates the intermediate state after corners are solved.
      const uaPerm = PLL_CASES["Ua"].algorithm;
      const edgeOnlyState = solved.applyAlg(uaPerm);

      // Intermediate state: edges not solved, corners solved = edge-only PLL remaining
      await session.onMove("R", 1000, scrambledState.applyMove("R")); // start solving
      // Now simulate reaching an edge-only state
      await session.onMove("U", 1100, edgeOnlyState);

      expect(session.was2Look).toBe(true);
    });

    it("flags 2-look when known case is solved via edges then corners", async () => {
      const store = createMockStatsStore(["T"]);
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      await session.startNextCase();
      const scrambledState = solved.applyAlg(session.scramble);
      session.onCubeState(scrambledState);

      // Simulate reaching a corner-only PLL state (edges solved, corners not)
      const aaPerm = PLL_CASES["Aa"].algorithm;
      const cornerOnlyState = solved.applyAlg(aaPerm);

      await session.onMove("R", 1000, scrambledState.applyMove("R")); // start solving
      await session.onMove("U", 1100, cornerOnlyState);

      expect(session.was2Look).toBe(true);
    });

    it("does NOT flag 2-look for unknown case", async () => {
      // T is NOT in known cases
      const store = createMockStatsStore(["Jb"]); // only Jb is known
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      await session.startNextCase();
      const scrambledState = solved.applyAlg(session.scramble);
      session.onCubeState(scrambledState);

      // Simulate reaching an edge-only PLL state
      const uaPerm = PLL_CASES["Ua"].algorithm;
      const edgeOnlyState = solved.applyAlg(uaPerm);

      await session.onMove("R", 1000, scrambledState.applyMove("R"));
      await session.onMove("U", 1100, edgeOnlyState);

      expect(session.was2Look).toBe(false);
    });

    it("does NOT flag 2-look on non-partial intermediate state", async () => {
      const store = createMockStatsStore(["T"]);
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      await session.startNextCase();
      const scrambledState = solved.applyAlg(session.scramble);
      session.onCubeState(scrambledState);

      // Apply a random move that doesn't produce a partial PLL state
      const intermediateState = scrambledState.applyMove("R");
      await session.onMove("R", 1000, intermediateState);

      expect(session.was2Look).toBe(false);
    });
  });

  describe("move recording", () => {
    it("records moves with relative timestamps", async () => {
      const store = createMockStatsStore();
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      const scrambledState = await advanceToReady(session);

      const s1 = scrambledState.applyMove("R");
      await session.onMove("R", 5000, s1);
      const s2 = s1.applyMove("U");
      await session.onMove("U", 5300, s2);

      expect(session.moves).toHaveLength(2);
      expect(session.moves[0]).toEqual({ move: "R", timestamp: 0 });
      expect(session.moves[1]).toEqual({ move: "U", timestamp: 300 });
    });

    it("tracks move count", async () => {
      const store = createMockStatsStore();
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      const scrambledState = await advanceToReady(session);

      let state = scrambledState;
      for (const m of ["R", "U", "R'", "U'"]) {
        state = state.applyAlg(m);
        await session.onMove(m, 1000, state);
      }

      expect(session.moveCount).toBe(4);
    });
  });

  describe("duration", () => {
    it("returns 0 when not in review phase", async () => {
      const store = createMockStatsStore();
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      expect(session.duration).toBe(0);

      const scrambledState = await advanceToReady(session);
      expect(session.duration).toBe(0);

      await session.onMove("R", 1000, scrambledState.applyMove("R"));
      expect(session.duration).toBe(0); // still solving
    });

    it("returns correct duration after solve", async () => {
      const store = createMockStatsStore();
      const selector = createMockSelector("H");
      const session = new PllDrillSession(store, selector);

      await session.startNextCase();
      const scrambledState = solved.applyAlg(session.scramble);
      session.onCubeState(scrambledState);

      // Solve: apply inverse of scramble
      const solveAlg = new Alg(session.scramble).invert();
      let state = scrambledState;
      let time = 2000;
      for (const moveNode of solveAlg.childAlgNodes()) {
        time += 200;
        state = state.applyAlg(moveNode.toString());
        await session.onMove(moveNode.toString(), time, state);
      }

      expect(session.phase).toBe("review");
      expect(session.duration).toBeGreaterThan(0);
    });
  });

  describe("attempt persistence", () => {
    it("calls recordAttempt on stats store when solve completes", async () => {
      const store = createMockStatsStore(["H"]);
      const selector = createMockSelector("H");
      const session = new PllDrillSession(store, selector);

      await session.startNextCase();
      const scrambledState = solved.applyAlg(session.scramble);
      session.onCubeState(scrambledState);

      // Solve: apply inverse of scramble
      const solveAlg = new Alg(session.scramble).invert();
      let state = scrambledState;
      let time = 1000;
      for (const moveNode of solveAlg.childAlgNodes()) {
        time += 100;
        state = state.applyAlg(moveNode.toString());
        await session.onMove(moveNode.toString(), time, state);
      }

      expect(store.recordAttempt).toHaveBeenCalledTimes(1);
      const attempt = (store.recordAttempt as ReturnType<typeof vi.fn>).mock
        .calls[0][0];
      expect(attempt.caseName).toBe("H");
      expect(attempt.time).toBeGreaterThan(0);
      expect(attempt.moveCount).toBeGreaterThan(0);
      expect(typeof attempt.was2Look).toBe("boolean");
      expect(typeof attempt.id).toBe("string");
      expect(typeof attempt.timestamp).toBe("number");
    });
  });

  describe("phase listeners", () => {
    it("emits phase change events", async () => {
      const store = createMockStatsStore();
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      const phases: DrillPhase[] = [];
      session.addPhaseListener((phase) => phases.push(phase));

      await session.startNextCase();
      expect(phases).toEqual(["selecting", "scrambling"]);
    });

    it("can remove phase listeners", async () => {
      const store = createMockStatsStore();
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      const phases: DrillPhase[] = [];
      const listener = (phase: DrillPhase) => phases.push(phase);
      session.addPhaseListener(listener);
      session.removePhaseListener(listener);

      await session.startNextCase();
      expect(phases).toEqual([]);
    });
  });

  describe("guards", () => {
    it("ignores startNextCase when not idle or review", async () => {
      const store = createMockStatsStore();
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      await session.startNextCase(); // now scrambling
      expect(session.phase).toBe("scrambling");

      // Calling again should be ignored
      await session.startNextCase();
      expect(session.phase).toBe("scrambling");
    });

    it("ignores onCubeState when not scrambling", async () => {
      const store = createMockStatsStore();
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      // In idle phase, onCubeState should do nothing
      session.onCubeState(solved);
      expect(session.phase).toBe("idle");
    });

    it("ignores onMove when not ready or solving", async () => {
      const store = createMockStatsStore();
      const selector = createMockSelector("T");
      const session = new PllDrillSession(store, selector);

      // In idle phase
      await session.onMove("R", 1000, solved);
      expect(session.phase).toBe("idle");
    });
  });
});
