import { describe, it, expect } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { SolveSession } from "@/core/solve-session";

async function setup() {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();
  return { kpuzzle, solved };
}

describe("SolveSession", () => {
  it("starts in idle phase", () => {
    const session = new SolveSession();
    expect(session.phase).toBe("idle");
  });

  it("transitions to scrambling when startScramble is called", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState);
    expect(session.phase).toBe("scrambling");
    expect(session.scramble).toBe("R U R' U'");
  });

  it("transitions to ready when cube state matches expected scramble", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState);
    session.onCubeState(expectedState);
    expect(session.phase).toBe("ready");
  });

  it("stays in scrambling when cube state does not match", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState);
    session.onCubeState(solved); // wrong state
    expect(session.phase).toBe("scrambling");
  });

  it("transitions to solving on first move after ready", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState);
    session.onCubeState(expectedState);
    expect(session.phase).toBe("ready");

    const afterMove = expectedState.applyMove("U");
    session.onMove("U", 1000, afterMove);
    expect(session.phase).toBe("solving");
    expect(session.moves).toHaveLength(1);
    expect(session.moves[0].move).toBe("U");
  });

  it("transitions to solved when cube reaches solved state", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const expectedState = solved.applyMove("R");

    session.startScramble("R", expectedState);
    session.onCubeState(expectedState);

    const afterRPrime = expectedState.applyMove("R'");
    session.onMove("R'", 1000, afterRPrime);
    expect(session.phase).toBe("solved");
  });

  it("records all moves with relative timestamps", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const scrambled = solved.applyAlg("R U");

    session.startScramble("R U", scrambled);
    session.onCubeState(scrambled);

    const s1 = scrambled.applyMove("U'");
    session.onMove("U'", 5000, s1);
    const s2 = s1.applyMove("R'");
    session.onMove("R'", 5500, s2);

    expect(session.phase).toBe("solved");
    expect(session.moves).toHaveLength(2);
    expect(session.moves[0].timestamp).toBe(0);
    expect(session.moves[1].timestamp).toBe(500);
  });

  it("provides duration after solve completes", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const scrambled = solved.applyMove("R");

    session.startScramble("R", scrambled);
    session.onCubeState(scrambled);
    session.onMove("R'", 1000, solved);

    expect(session.duration).toBe(0);
  });

  it("reset returns to idle", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const scrambled = solved.applyMove("R");

    session.startScramble("R", scrambled);
    session.reset();
    expect(session.phase).toBe("idle");
  });

  it("emits phase change events", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const scrambled = solved.applyMove("R");

    const phases: string[] = [];
    session.addPhaseListener((phase) => phases.push(phase));

    session.startScramble("R", scrambled);
    session.onCubeState(scrambled);
    session.onMove("R'", 1000, solved);

    expect(phases).toEqual(["scrambling", "ready", "solving", "solved"]);
  });
});
