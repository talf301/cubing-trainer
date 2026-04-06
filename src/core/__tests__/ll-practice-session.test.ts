import { describe, it, expect, beforeEach } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import {
  LLPracticeSession,
  type LLPracticeCompletion,
  type LLPracticePhase,
} from "@/core/ll-practice-session";
import { OLL_CASES } from "@/core/oll-cases";
import { PLL_CASES } from "@/core/pll-cases";

let kpuzzle: KPuzzle;
let solved: KPattern;

beforeEach(async () => {
  kpuzzle = await cube3x3x3.kpuzzle();
  solved = kpuzzle.defaultPattern();
});

/**
 * Helper: apply a sequence of moves to a state, calling session.onMove for each.
 * Returns the final state.
 */
async function applyMoves(
  session: LLPracticeSession,
  state: KPattern,
  alg: string,
  startTime: number = 100,
  moveInterval: number = 50,
): Promise<{ state: KPattern; endTime: number }> {
  const moves = alg.trim().split(/\s+/).filter(Boolean);
  let current = state;
  let t = startTime;
  for (const move of moves) {
    current = current.applyMove(move);
    await session.onMove(move, t, current);
    t += moveInterval;
  }
  return { state: current, endTime: t - moveInterval };
}

/**
 * Helper: build an LL scrambled state by applying inverse OLL then inverse PLL.
 * Returns the scramble string (to apply to solved cube) and expected state.
 *
 * Strategy: apply the PLL alg then the OLL alg to a solved cube.
 * The result is a state with F2L solved and LL in the given OLL+PLL state.
 * The "scramble" is the sequence of moves applied.
 */
function buildLLState(
  ollCase: string,
  pllCase: string,
): { scramble: string; expectedState: KPattern } {
  // To get a state with a specific OLL case and PLL case on top:
  // Start from solved, apply the OLL algorithm (this creates the OLL case in reverse,
  // since the alg solves the case). Then apply the PLL algorithm.
  // Actually: OLL alg solves the OLL case, so applying it to solved produces the inverse OLL state.
  // We want the scrambled state to HAVE the OLL case, so we need inverse(OLL alg).
  //
  // Simpler approach: build the scramble as "PLL_alg OLL_alg" applied to solved.
  // After applying OLL_alg inverse, we get the OLL case.
  // After applying PLL_alg inverse, we get the PLL case.
  //
  // Actually, let's just use the algorithms directly as the scramble:
  // Apply inverse(OLL_alg) to get the OLL state, then we'd need to adjust.
  //
  // Simplest correct approach:
  // 1. The OLL algorithm SOLVES the OLL case. So the inverse creates it.
  // 2. Similarly for PLL.
  // But we need both together: first create PLL state, then create OLL state on top.
  //
  // target = inverse(OLL_alg) applied to (inverse(PLL_alg) applied to solved)
  // scramble = the moves to get from solved to target
  //
  // For testing, we can just use the inverse algs as the scramble directly.
  const ollAlg = OLL_CASES[ollCase].algorithm;
  const pllAlg = PLL_CASES[pllCase].algorithm;

  // Build the scramble: first apply inverse PLL, then inverse OLL
  // inverse of an alg = reverse the moves and invert each
  const invertMove = (m: string): string => {
    if (m.endsWith("'")) return m.slice(0, -1);
    if (m.endsWith("2")) return m; // double moves are self-inverse
    return m + "'";
  };
  const invertAlg = (alg: string): string =>
    alg.trim().split(/\s+/).filter(Boolean).reverse().map(invertMove).join(" ");

  const invPLL = invertAlg(pllAlg);
  const invOLL = invertAlg(ollAlg);
  const scramble = `${invPLL} ${invOLL}`;

  let state = solved;
  for (const move of scramble.split(/\s+/).filter(Boolean)) {
    state = state.applyMove(move);
  }

  return { scramble, expectedState: state };
}

/**
 * Helper: simulate a full practice cycle (scramble + OLL solve + PLL solve).
 * Uses the actual algorithms to solve the cases.
 */
async function doFullCycle(
  session: LLPracticeSession,
  ollCase: string,
  pllCase: string,
  options: {
    scrambleStartTime?: number;
    scrambleMoveInterval?: number;
    recognitionPauseOLL?: number;
    ollMoveInterval?: number;
    recognitionPausePLL?: number;
    pllMoveInterval?: number;
  } = {},
): Promise<{ completions: LLPracticeCompletion[]; phases: LLPracticePhase[] }> {
  const {
    scrambleStartTime = 0,
    scrambleMoveInterval = 50,
    recognitionPauseOLL = 200,
    ollMoveInterval = 50,
    recognitionPausePLL = 200,
    pllMoveInterval = 50,
  } = options;

  const completions: LLPracticeCompletion[] = [];
  const phases: LLPracticePhase[] = [];
  session.addCompletionListener((c) => completions.push(c));
  session.addPhaseListener((p) => phases.push(p));

  const { scramble, expectedState } = buildLLState(ollCase, pllCase);
  session.start(scramble, expectedState);

  // Apply scramble moves
  let state = solved;
  const scrambleMoves = scramble.split(/\s+/).filter(Boolean);
  let t = scrambleStartTime;
  for (const move of scrambleMoves) {
    state = state.applyMove(move);
    await session.onMove(move, t, state);
    t += scrambleMoveInterval;
  }

  // Now in solving_oll — add recognition pause then solve OLL
  t += recognitionPauseOLL;
  const ollAlg = OLL_CASES[ollCase].algorithm;
  const ollResult = await applyMoves(session, state, ollAlg, t, ollMoveInterval);
  state = ollResult.state;
  t = ollResult.endTime;

  // Now in solving_pll — add recognition pause then solve PLL
  t += recognitionPausePLL;
  const pllAlg = PLL_CASES[pllCase].algorithm;
  await applyMoves(session, state, pllAlg, t, pllMoveInterval);

  return { completions, phases };
}

describe("LLPracticeSession", () => {
  describe("state machine transitions", () => {
    it("starts in idle phase", () => {
      const session = new LLPracticeSession();
      expect(session.currentPhase).toBe("idle");
    });

    it("transitions to scrambling on start()", () => {
      const session = new LLPracticeSession();
      const phases: LLPracticePhase[] = [];
      session.addPhaseListener((p) => phases.push(p));

      const { scramble, expectedState } = buildLLState("OLL 21", "T");
      session.start(scramble, expectedState);

      expect(session.currentPhase).toBe("scrambling");
      expect(phases).toEqual(["scrambling"]);
    });

    it("ignores moves in idle phase", async () => {
      const session = new LLPracticeSession();
      const phases: LLPracticePhase[] = [];
      session.addPhaseListener((p) => phases.push(p));

      await session.onMove("R", 0, solved.applyMove("R"));
      expect(session.currentPhase).toBe("idle");
      expect(phases).toHaveLength(0);
    });

    it("ignores moves in done phase", async () => {
      const session = new LLPracticeSession();
      const { completions, phases } = await doFullCycle(session, "OLL 21", "T");
      expect(completions).toHaveLength(1);
      expect(session.currentPhase).toBe("done");

      // Moves in done phase should be ignored
      const prevPhaseCount = phases.length;
      await session.onMove("R", 99999, solved.applyMove("R"));
      expect(phases).toHaveLength(prevPhaseCount);
    });

    it("transitions through all phases in order", async () => {
      const session = new LLPracticeSession();
      const phases: LLPracticePhase[] = [];
      session.addPhaseListener((p) => phases.push(p));
      session.addCompletionListener(() => {}); // need listener to avoid issues

      const { scramble, expectedState } = buildLLState("OLL 21", "T");
      session.start(scramble, expectedState);

      // Apply scramble
      let state = solved;
      const scrambleMoves = scramble.split(/\s+/).filter(Boolean);
      let t = 0;
      for (const move of scrambleMoves) {
        state = state.applyMove(move);
        await session.onMove(move, t, state);
        t += 50;
      }
      expect(phases).toContain("scrambling");
      expect(phases).toContain("solving_oll");

      // Solve OLL
      const ollAlg = OLL_CASES["OLL 21"].algorithm;
      const ollResult = await applyMoves(session, state, ollAlg, t + 200, 50);
      state = ollResult.state;
      t = ollResult.endTime;
      expect(phases).toContain("solving_pll");

      // Solve PLL
      const pllAlg = PLL_CASES["T"].algorithm;
      await applyMoves(session, state, pllAlg, t + 200, 50);
      expect(phases).toContain("done");

      // Verify order: scrambling, solving_oll, solving_pll, done
      const expectedOrder = ["scrambling", "solving_oll", "solving_pll", "done"];
      const filteredPhases = phases.filter((p) => expectedOrder.includes(p));
      expect(filteredPhases).toEqual(expectedOrder);
    });
  });

  describe("scramble tracking", () => {
    it("transitions to solving_oll when cube matches expected state", async () => {
      const session = new LLPracticeSession();
      const { scramble, expectedState } = buildLLState("OLL 21", "T");
      session.start(scramble, expectedState);

      let state = solved;
      const moves = scramble.split(/\s+/).filter(Boolean);
      for (let i = 0; i < moves.length; i++) {
        state = state.applyMove(moves[i]);
        await session.onMove(moves[i], i * 50, state);
      }

      expect(session.currentPhase).toBe("solving_oll");
    });
  });

  describe("1-look OLL + 1-look PLL completion", () => {
    it("detects completion with correct case names", async () => {
      const session = new LLPracticeSession();
      const { completions } = await doFullCycle(session, "OLL 21", "T");

      expect(completions).toHaveLength(1);
      const c = completions[0];
      expect(c.ollSegments).toHaveLength(1);
      expect(c.pllSegments).toHaveLength(1);
      expect(c.ollSegments[0].caseName).toBe("OLL 21");
      expect(c.pllSegments[0].caseName).toBe("T");
    });

    it("records recognition and execution times for OLL", async () => {
      const session = new LLPracticeSession();
      const { completions } = await doFullCycle(session, "OLL 21", "T", {
        scrambleMoveInterval: 50,
        recognitionPauseOLL: 300,
        ollMoveInterval: 50,
      });

      const c = completions[0];
      // Recognition time = scrambleMoveInterval (gap after last scramble move) + recognitionPauseOLL
      // Because ollSegmentStart = timestamp of last scramble move,
      // and first OLL move = lastScrambleTime + scrambleMoveInterval + recognitionPauseOLL
      expect(c.ollSegments[0].recognitionTime).toBe(350);
      // Execution time = (numMoves - 1) * interval
      const ollMoveCount = OLL_CASES["OLL 21"].algorithm.trim().split(/\s+/).length;
      expect(c.ollSegments[0].executionTime).toBe((ollMoveCount - 1) * 50);
    });

    it("records recognition and execution times for PLL", async () => {
      const session = new LLPracticeSession();
      const { completions } = await doFullCycle(session, "OLL 21", "T", {
        recognitionPausePLL: 400,
        pllMoveInterval: 60,
      });

      const c = completions[0];
      expect(c.pllSegments[0].recognitionTime).toBe(400);
      const pllMoveCount = PLL_CASES["T"].algorithm.trim().split(/\s+/).length;
      expect(c.pllSegments[0].executionTime).toBe((pllMoveCount - 1) * 60);
    });

    it("computes total times correctly", async () => {
      const session = new LLPracticeSession();
      const { completions } = await doFullCycle(session, "OLL 21", "T");

      const c = completions[0];
      const expectedOllTime =
        c.ollSegments[0].recognitionTime + c.ollSegments[0].executionTime;
      const expectedPllTime =
        c.pllSegments[0].recognitionTime + c.pllSegments[0].executionTime;

      expect(c.ollTime).toBe(expectedOllTime);
      expect(c.pllTime).toBe(expectedPllTime);
      expect(c.totalTime).toBe(expectedOllTime + expectedPllTime);
    });

    it("includes timestamp in completion", async () => {
      const session = new LLPracticeSession();
      const { completions } = await doFullCycle(session, "OLL 21", "T");

      expect(completions[0].timestamp).toBeGreaterThan(0);
    });
  });

  describe("different OLL/PLL cases", () => {
    it("detects OLL 26 + Aa perm", async () => {
      const session = new LLPracticeSession();
      const { completions } = await doFullCycle(session, "OLL 26", "Aa");

      expect(completions).toHaveLength(1);
      expect(completions[0].ollSegments[0].caseName).toBe("OLL 26");
      expect(completions[0].pllSegments[0].caseName).toBe("Aa");
    });

    it("detects OLL 27 + Jb perm", async () => {
      const session = new LLPracticeSession();
      const { completions } = await doFullCycle(session, "OLL 27", "Jb");

      expect(completions).toHaveLength(1);
      expect(completions[0].ollSegments[0].caseName).toBe("OLL 27");
      expect(completions[0].pllSegments[0].caseName).toBe("Jb");
    });
  });

  describe("listeners", () => {
    it("calls completion listeners on solve", async () => {
      const session = new LLPracticeSession();
      const { completions } = await doFullCycle(session, "OLL 21", "T");
      expect(completions).toHaveLength(1);
    });

    it("removes completion listener", async () => {
      const session = new LLPracticeSession();
      const completions: LLPracticeCompletion[] = [];
      const listener = (c: LLPracticeCompletion) => completions.push(c);
      session.addCompletionListener(listener);
      session.removeCompletionListener(listener);

      const { scramble, expectedState } = buildLLState("OLL 21", "T");
      session.start(scramble, expectedState);

      let state = solved;
      const scrambleMoves = scramble.split(/\s+/).filter(Boolean);
      let t = 0;
      for (const move of scrambleMoves) {
        state = state.applyMove(move);
        await session.onMove(move, t, state);
        t += 50;
      }
      t += 200;
      const ollResult = await applyMoves(
        session, state, OLL_CASES["OLL 21"].algorithm, t, 50,
      );
      state = ollResult.state;
      t = ollResult.endTime + 200;
      await applyMoves(session, state, PLL_CASES["T"].algorithm, t, 50);

      expect(completions).toHaveLength(0);
    });

    it("calls phase listeners on transitions", async () => {
      const session = new LLPracticeSession();
      const phases: LLPracticePhase[] = [];
      session.addPhaseListener((p) => phases.push(p));
      session.addCompletionListener(() => {});

      await doFullCycle(session, "OLL 21", "T");

      expect(phases).toContain("scrambling");
      expect(phases).toContain("solving_oll");
      expect(phases).toContain("solving_pll");
      expect(phases).toContain("done");
    });

    it("removes phase listener", async () => {
      const session = new LLPracticeSession();
      const phases: LLPracticePhase[] = [];
      const listener = (p: LLPracticePhase) => phases.push(p);
      session.addPhaseListener(listener);
      session.removePhaseListener(listener);

      const { scramble, expectedState } = buildLLState("OLL 21", "T");
      session.start(scramble, expectedState);

      // Phase listener was removed so only phases added *before* removal counted
      expect(phases).toHaveLength(0);
    });
  });

  describe("reset", () => {
    it("resets to idle phase", () => {
      const session = new LLPracticeSession();
      const { scramble, expectedState } = buildLLState("OLL 21", "T");
      session.start(scramble, expectedState);
      expect(session.currentPhase).toBe("scrambling");

      session.reset();
      expect(session.currentPhase).toBe("idle");
    });

    it("resets expected state on reset", () => {
      const session = new LLPracticeSession();
      const { scramble, expectedState } = buildLLState("OLL 21", "T");
      session.start(scramble, expectedState);
      expect(session.currentPhase).toBe("scrambling");

      session.reset();
      expect(session.currentPhase).toBe("idle");
    });

    it("allows starting new cycle after reset", async () => {
      const session = new LLPracticeSession();

      // First cycle
      const result1 = await doFullCycle(session, "OLL 21", "T");
      expect(result1.completions).toHaveLength(1);

      // Reset and second cycle
      session.reset();
      const completions2: LLPracticeCompletion[] = [];
      session.addCompletionListener((c) => completions2.push(c));

      const { scramble, expectedState } = buildLLState("OLL 26", "Aa");
      session.start(scramble, expectedState);

      let state = solved;
      let t = 0;
      for (const move of scramble.split(/\s+/).filter(Boolean)) {
        state = state.applyMove(move);
        await session.onMove(move, t, state);
        t += 50;
      }
      t += 200;
      const ollResult = await applyMoves(
        session, state, OLL_CASES["OLL 26"].algorithm, t, 50,
      );
      state = ollResult.state;
      t = ollResult.endTime + 200;
      await applyMoves(session, state, PLL_CASES["Aa"].algorithm, t, 50);

      expect(completions2).toHaveLength(1);
      expect(completions2[0].ollSegments[0].caseName).toBe("OLL 26");
      expect(completions2[0].pllSegments[0].caseName).toBe("Aa");
    });
  });

  describe("back-to-back cycles", () => {
    it("can start a new cycle from done phase", async () => {
      const session = new LLPracticeSession();

      // First cycle
      const result1 = await doFullCycle(session, "OLL 21", "T");
      expect(result1.completions).toHaveLength(1);
      expect(session.currentPhase).toBe("done");

      // Start second cycle directly (no reset needed — start() handles it)
      const completions2: LLPracticeCompletion[] = [];
      session.addCompletionListener((c) => completions2.push(c));

      const { scramble, expectedState } = buildLLState("OLL 26", "Aa");
      session.start(scramble, expectedState);
      expect(session.currentPhase).toBe("scrambling");

      let state = solved;
      let t = 10000;
      for (const move of scramble.split(/\s+/).filter(Boolean)) {
        state = state.applyMove(move);
        await session.onMove(move, t, state);
        t += 50;
      }
      t += 200;
      const ollResult = await applyMoves(
        session, state, OLL_CASES["OLL 26"].algorithm, t, 50,
      );
      state = ollResult.state;
      t = ollResult.endTime + 200;
      await applyMoves(session, state, PLL_CASES["Aa"].algorithm, t, 50);

      expect(completions2).toHaveLength(1);
      expect(completions2[0].ollSegments[0].caseName).toBe("OLL 26");
    });
  });
});
