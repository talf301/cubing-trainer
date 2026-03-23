import { describe, it, expect, vi, beforeEach } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { Alg } from "cubing/alg";
import { CrossTrainerSession } from "@/core/cross-trainer-session";
import { buildFaceGeometry, isCrossSolved } from "@/core/cfop-segmenter";

// Mock solveOptimalCross since cubing.js search workers
// don't work in Vitest's jsdom/node environment
vi.mock("@/core/cross-solver", () => ({
  solveOptimalCross: vi.fn(),
}));

import { solveOptimalCross } from "@/core/cross-solver";
const mockSolveOptimalCross = vi.mocked(solveOptimalCross);

async function setup() {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();
  return { kpuzzle, solved };
}

describe("CrossTrainerSession", () => {
  beforeEach(() => {
    mockSolveOptimalCross.mockReset();
    mockSolveOptimalCross.mockResolvedValue(new Alg("R D R'"));
  });

  it("starts in idle phase", () => {
    const session = new CrossTrainerSession();
    expect(session.phase).toBe("idle");
  });

  it("transitions to scrambling when startScramble is called", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState, kpuzzle, "D");
    expect(session.phase).toBe("scrambling");
    expect(session.scramble).toBe("R U R' U'");
    expect(session.crossFace).toBe("D");
  });

  it("kicks off solver in startScramble", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState, kpuzzle, "D");
    expect(mockSolveOptimalCross).toHaveBeenCalledOnce();
    expect(mockSolveOptimalCross).toHaveBeenCalledWith(
      kpuzzle,
      expect.anything(),
      "D",
    );
  });

  it("transitions to ready when cube state matches expected scramble", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState, kpuzzle);
    session.onCubeState(expectedState);
    expect(session.phase).toBe("ready");
  });

  it("stays in scrambling when cube state does not match", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState, kpuzzle);
    session.onCubeState(solved); // wrong state
    expect(session.phase).toBe("scrambling");
  });

  it("transitions to solving on first move after ready", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    // Use a scramble that disrupts cross enough that one F move won't fix it
    const expectedState = solved.applyAlg("R F L B");

    session.startScramble("R F L B", expectedState, kpuzzle);
    session.onCubeState(expectedState);
    expect(session.phase).toBe("ready");

    const afterMove = expectedState.applyMove("F");
    session.onMove("F", 1000, afterMove);
    expect(session.phase).toBe("solving");
    expect(session.moves).toHaveLength(1);
    expect(session.moves[0].move).toBe("F");
  });

  it("transitions to review when cross is solved", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    const geometry = buildFaceGeometry(kpuzzle);

    // Use a scramble that only disrupts the D cross
    // Apply R which moves a D-layer edge out of place
    const scrambled = solved.applyMove("R");

    session.startScramble("R", scrambled, kpuzzle, "D");
    session.onCubeState(scrambled);

    // Undo with R' to restore the cross
    const afterRPrime = scrambled.applyMove("R'");

    // Verify the cross is actually solved after R'
    expect(isCrossSolved(afterRPrime, geometry, 5)).toBe(true);

    session.onMove("R'", 1000, afterRPrime);
    expect(session.phase).toBe("review");
  });

  it("records all moves with relative timestamps", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();

    const scrambled = solved.applyMove("R");
    session.startScramble("R", scrambled, kpuzzle, "D");
    session.onCubeState(scrambled);

    // First move (won't solve cross yet if we do something unrelated)
    const s1 = scrambled.applyMove("U");
    session.onMove("U", 5000, s1);

    // Second move: undo the U
    const s2 = s1.applyMove("U'");
    session.onMove("U'", 5300, s2);

    // Third move: solve the cross
    const s3 = s2.applyMove("R'");
    session.onMove("R'", 5500, s3);

    expect(session.phase).toBe("review");
    expect(session.moves).toHaveLength(3);
    expect(session.moves[0].timestamp).toBe(0);
    expect(session.moves[1].timestamp).toBe(300);
    expect(session.moves[2].timestamp).toBe(500);
  });

  it("provides duration after cross is solved", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();

    const scrambled = solved.applyMove("R");
    session.startScramble("R", scrambled, kpuzzle, "D");
    session.onCubeState(scrambled);

    session.onMove("R'", 1000, solved);
    expect(session.phase).toBe("review");
    // Duration: endTime(1000) - startTime(1000) = 0 (single move)
    expect(session.duration).toBe(0);
  });

  it("returns 0 duration before review phase", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();

    const scrambled = solved.applyMove("R");
    session.startScramble("R", scrambled, kpuzzle, "D");
    expect(session.duration).toBe(0);
  });

  it("emits phase change events", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    const scrambled = solved.applyMove("R");

    const phases: string[] = [];
    session.addPhaseListener((phase) => phases.push(phase));

    session.startScramble("R", scrambled, kpuzzle, "D");
    session.onCubeState(scrambled);
    session.onMove("R'", 1000, solved);

    expect(phases).toEqual(["scrambling", "ready", "solving", "review"]);
  });

  it("can remove phase listeners", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    const scrambled = solved.applyMove("R");

    const phases: string[] = [];
    const listener = (phase: string) => phases.push(phase);
    session.addPhaseListener(listener);

    session.startScramble("R", scrambled, kpuzzle, "D");
    session.removePhaseListener(listener);
    session.onCubeState(scrambled);

    // Only "scrambling" should have been captured
    expect(phases).toEqual(["scrambling"]);
  });

  it("getResult returns result shape with solver promise and undo alg", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    const geometry = buildFaceGeometry(kpuzzle);

    const optimalAlg = new Alg("R' F'");
    mockSolveOptimalCross.mockResolvedValue(optimalAlg);

    // Use "R F" scramble - needs both R' and F' to restore D cross
    const scrambled = solved.applyAlg("R F");
    session.startScramble("R F", scrambled, kpuzzle, "D");
    session.onCubeState(scrambled);

    // Solve with F' R' (cross solved after both moves)
    const s1 = scrambled.applyMove("F'");
    session.onMove("F'", 1000, s1);
    expect(isCrossSolved(s1, geometry, 5)).toBe(false);

    const s2 = s1.applyMove("R'");
    session.onMove("R'", 1200, s2);
    expect(isCrossSolved(s2, geometry, 5)).toBe(true);

    expect(session.phase).toBe("review");

    const result = await session.getResult();
    expect(result.scramble).toBe("R F");
    expect(result.crossFace).toBe("D");
    expect(result.moves).toHaveLength(2);
    expect(result.duration).toBe(200);
    expect(result.optimalSolution).toBe(optimalAlg);
    // undoAlg should reverse+invert [F', R'] -> R F
    expect(result.undoAlg.toString()).toBe("R F");
  });

  it("getResult throws if not in review phase", async () => {
    const session = new CrossTrainerSession();
    await expect(session.getResult()).rejects.toThrow(
      "Cannot get result outside of review phase",
    );
  });

  it("reset returns to idle and clears state", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    const scrambled = solved.applyMove("R");

    session.startScramble("R", scrambled, kpuzzle, "D");
    session.onCubeState(scrambled);
    session.onMove("R'", 1000, solved);
    expect(session.phase).toBe("review");

    session.reset();
    expect(session.phase).toBe("idle");
    expect(session.scramble).toBe("");
    expect(session.crossFace).toBe("D");
    expect(session.moves).toHaveLength(0);
    expect(session.duration).toBe(0);
  });

  it("defaults to D-face cross", async () => {
    const session = new CrossTrainerSession();
    const { kpuzzle, solved } = await setup();
    const scrambled = solved.applyMove("R");

    session.startScramble("R", scrambled, kpuzzle);
    expect(session.crossFace).toBe("D");
    expect(mockSolveOptimalCross).toHaveBeenCalledWith(
      kpuzzle,
      expect.anything(),
      "D",
    );
  });
});
