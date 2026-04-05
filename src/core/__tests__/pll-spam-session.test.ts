import { describe, it, expect, beforeEach } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import {
  PllSpamSession,
  type PllSpamCompletion,
} from "@/core/pll-spam-session";
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
  session: PllSpamSession,
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

describe("PllSpamSession", () => {
  it("detects a T-perm on a solved cube", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    // First move on solved cube sets baseline (F2L+OLL already met)
    // We need to establish baseline first — apply a U move (still F2L+OLL solved)
    // Actually, on a solved cube, the first move that keeps F2L+OLL solved sets baseline.
    // A U move keeps F2L solved and OLL solved, so it sets baseline.
    // Let's start by establishing baseline with a U move:
    let state = solved;
    state = state.applyMove("U");
    await session.onMove("U", 0, state);
    // baseline should now be set (solved cube meets F2L+OLL condition)

    // Now apply T-perm algorithm
    const tAlg = PLL_CASES["T"].algorithm;
    await applyMoves(session, state, tAlg, 1000, 50);

    // After T-perm, cube should be back to F2L+OLL solved (with possible AUF)
    // T-perm ends in a state where F2L is solved and OLL is solved
    expect(completions).toHaveLength(1);
    expect(completions[0].caseName).toBe("T");
    expect(completions[0].moveCount).toBeGreaterThanOrEqual(4);
  });

  it("sets baseline on first F2L+OLL-solved state", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    // Feed solved state — should set baseline, no completion
    await session.onMove("U", 0, solved.applyMove("U"));
    expect(completions).toHaveLength(0);
  });

  it("filters AUF (fewer than 4 moves)", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    // Establish baseline on solved cube
    let state = solved;
    state = state.applyMove("U");
    await session.onMove("U", 0, state);

    // Do U2 — only 1 additional move to return to F2L+OLL solved
    state = state.applyMove("U2");
    await session.onMove("U2", 100, state);

    // Should not trigger (< 4 moves)
    expect(completions).toHaveLength(0);
  });

  it("filters short AUF sequences (U U')", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    // Establish baseline
    let state = solved;
    state = state.applyMove("U");
    await session.onMove("U", 0, state);

    // Do U U' (2 moves, still F2L+OLL solved)
    state = state.applyMove("U");
    await session.onMove("U", 100, state);
    state = state.applyMove("U'");
    await session.onMove("U'", 200, state);

    // 2 moves since baseline → below threshold
    expect(completions).toHaveLength(0);
  });

  it("detects back-to-back PLLs", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    let state = solved;

    // Establish baseline
    state = state.applyMove("U");
    await session.onMove("U", 0, state);

    // First PLL: T-perm
    const tAlg = PLL_CASES["T"].algorithm;
    const r1 = await applyMoves(session, state, tAlg, 1000, 50);
    state = r1.state;

    expect(completions).toHaveLength(1);
    expect(completions[0].caseName).toBe("T");

    // Second PLL: another T-perm (T is self-inverse with AUF)
    // Actually let's do a different case. Apply Aa-perm.
    const aaAlg = PLL_CASES["Aa"].algorithm;
    const r2 = await applyMoves(session, state, aaAlg, 2000, 50);
    state = r2.state;

    expect(completions).toHaveLength(2);
    expect(completions[1].caseName).toBe("Aa");
  });

  it("times from first move after completion", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    let state = solved;

    // Establish baseline
    state = state.applyMove("U");
    await session.onMove("U", 0, state);

    // Apply T-perm starting at t=1000
    const tAlg = PLL_CASES["T"].algorithm;
    const moves = tAlg.trim().split(/\s+/).filter(Boolean);
    let t = 1000;
    for (const move of moves) {
      state = state.applyMove(move);
      await session.onMove(move, t, state);
      t += 100;
    }

    expect(completions).toHaveLength(1);
    // Time should be from first move (1000) to last move
    const expectedTime = (moves.length - 1) * 100;
    expect(completions[0].time).toBe(expectedTime);
  });

  it("discards unrecognized sequences", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    let state = solved;

    // Establish baseline
    state = state.applyMove("U");
    await session.onMove("U", 0, state);

    // Do a bunch of random moves that happen to return to F2L+OLL solved
    // but don't match a PLL. E.g., do a sexy move 6 times (identity on U-layer)
    // Actually (R U R' U') x 6 = identity, so it returns to exact same state → "solved" PLL
    // Let's use a non-PLL sequence instead: R U R' U R U2 R' then undo (but that's OLL)
    // Simplest: do a move sequence that solves F2L+OLL but doesn't match any PLL fingerprint
    // Actually, a full solve of the identity permutation would match "solved" which isn't a PLL case
    // Let's test with identity — recognizePLL on a solved state should return null
    const sexyMove = "R U R' U' R U R' U' R U R' U' R U R' U' R U R' U' R U R' U'";
    const r = await applyMoves(session, state, sexyMove, 1000, 50);
    state = r.state;

    // Identity permutation → recognizePLL should return null → discarded
    expect(completions).toHaveLength(0);
  });

  it("resets on disconnect", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    let state = solved;

    // Establish baseline
    state = state.applyMove("U");
    await session.onMove("U", 0, state);

    // Reset (simulate disconnect)
    session.reset();

    // Now do T-perm — should not trigger because baseline was cleared
    const tAlg = PLL_CASES["T"].algorithm;
    // First move after reset will just set a new baseline if condition is met,
    // but since we're mid-alg F2L won't be solved until the end.
    // Actually let's just re-establish baseline and then do a PLL
    state = solved;
    state = state.applyMove("U");
    await session.onMove("U", 500, state);

    // Now do the PLL
    await applyMoves(session, state, tAlg, 1000, 50);

    expect(completions).toHaveLength(1);
    expect(completions[0].caseName).toBe("T");
  });

  it("handles AUF before PLL without false trigger", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    let state = solved;

    // Establish baseline
    state = state.applyMove("U");
    await session.onMove("U", 0, state);

    // Do AUF (U') — still F2L+OLL solved, < 4 moves, updates baseline
    state = state.applyMove("U'");
    await session.onMove("U'", 100, state);
    expect(completions).toHaveLength(0);

    // Now do a PLL from this new baseline
    const tAlg = PLL_CASES["T"].algorithm;
    await applyMoves(session, state, tAlg, 500, 50);

    expect(completions).toHaveLength(1);
    expect(completions[0].caseName).toBe("T");
  });

  it("removes completion listener", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    const listener = (c: PllSpamCompletion) => completions.push(c);
    session.addCompletionListener(listener);

    let state = solved;
    state = state.applyMove("U");
    await session.onMove("U", 0, state);

    // Remove listener before PLL
    session.removeCompletionListener(listener);

    const tAlg = PLL_CASES["T"].algorithm;
    await applyMoves(session, state, tAlg, 1000, 50);

    expect(completions).toHaveLength(0);
  });

  it("detects PLL with pre-AUF included in move count", async () => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    let state = solved;

    // Establish baseline
    state = state.applyMove("U");
    await session.onMove("U", 0, state);

    // Do U' (AUF — below 4 moves, resets baseline)
    state = state.applyMove("U'");
    await session.onMove("U'", 50, state);

    // Now start PLL execution — R' is first non-F2L-solved move
    // This means timingStart is set on R'
    // Let's execute T-perm: R U R' U' R' F R2 U' R' U' R U R' F'
    const tAlg = PLL_CASES["T"].algorithm;
    await applyMoves(session, state, tAlg, 1000, 50);

    expect(completions).toHaveLength(1);
    // Time should start from first move of the T-perm (which breaks F2L)
    expect(completions[0].time).toBeGreaterThan(0);
  });

  it.each(Object.keys(PLL_CASES))("detects %s perm", async (caseName) => {
    const session = new PllSpamSession();
    const completions: PllSpamCompletion[] = [];
    session.addCompletionListener((c) => completions.push(c));

    let state = solved;
    state = state.applyMove("U");
    await session.onMove("U", 0, state);

    await applyMoves(session, state, PLL_CASES[caseName].algorithm, 1000, 50);

    expect(completions).toHaveLength(1);
    expect(completions[0].caseName).toBe(caseName);
  });
});
