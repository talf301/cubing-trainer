import { describe, it, expect } from "vitest";
import { ScrambleTracker } from "@/core/scramble-tracker";

describe("ScrambleTracker", () => {
  describe("tracking mode", () => {
    it("initializes with all moves incomplete", () => {
      const tracker = new ScrambleTracker("R U F");
      const state = tracker.state;
      expect(state.mode).toBe("tracking");
      expect(state.scrambleMoves).toEqual([
        { move: "R", completed: false },
        { move: "U", completed: false },
        { move: "F", completed: false },
      ]);
      expect(state.isComplete).toBe(false);
    });

    it("marks move as completed when correct move is made", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("R");
      const state = tracker.state;
      expect(state.scrambleMoves[0].completed).toBe(true);
      expect(state.scrambleMoves[1].completed).toBe(false);
      expect(state.mode).toBe("tracking");
    });

    it("tracks multiple correct moves in sequence", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("R");
      tracker.onMove("U");
      expect(tracker.state.scrambleMoves[0].completed).toBe(true);
      expect(tracker.state.scrambleMoves[1].completed).toBe(true);
      expect(tracker.state.scrambleMoves[2].completed).toBe(false);
    });

    it("reports complete when all moves done", () => {
      const tracker = new ScrambleTracker("R U");
      tracker.onMove("R");
      tracker.onMove("U");
      expect(tracker.state.isComplete).toBe(true);
    });

    it("handles prime moves", () => {
      const tracker = new ScrambleTracker("R' U2 F");
      tracker.onMove("R'");
      expect(tracker.state.scrambleMoves[0].completed).toBe(true);
      tracker.onMove("U2");
      expect(tracker.state.scrambleMoves[1].completed).toBe(true);
    });

    it("accepts two quarter turns for a double move", () => {
      const tracker = new ScrambleTracker("R2 U F");
      tracker.onMove("R"); // first quarter turn
      expect(tracker.state.scrambleMoves[0].completed).toBe(false);
      tracker.onMove("R"); // second quarter turn completes R2
      expect(tracker.state.scrambleMoves[0].completed).toBe(true);
      expect(tracker.state.mode).toBe("tracking");
    });

    it("handles mixed double and single moves", () => {
      const tracker = new ScrambleTracker("R2 U' F2");
      tracker.onMove("R");
      tracker.onMove("R"); // completes R2
      tracker.onMove("U'"); // completes U'
      tracker.onMove("F");
      tracker.onMove("F"); // completes F2
      expect(tracker.state.isComplete).toBe(true);
    });

    it("accepts two inverse quarter turns for a double move", () => {
      const tracker = new ScrambleTracker("R2 U F");
      tracker.onMove("R'"); // first quarter turn (inverse direction)
      expect(tracker.state.scrambleMoves[0].completed).toBe(false);
      tracker.onMove("R'"); // second quarter turn completes R2
      expect(tracker.state.scrambleMoves[0].completed).toBe(true);
      expect(tracker.state.mode).toBe("tracking");
    });

    it("rejects mixed directions for a double move", () => {
      const tracker = new ScrambleTracker("R2 U F");
      tracker.onMove("R"); // first quarter turn
      tracker.onMove("R'"); // wrong — must match first direction
      expect(tracker.state.mode).toBe("recovering");
    });

    it("enters error recovery when wrong move during pending half turn", () => {
      const tracker = new ScrambleTracker("R2 U F");
      tracker.onMove("R"); // first quarter turn of R2
      tracker.onMove("U"); // wrong — expected second R
      expect(tracker.state.mode).toBe("recovering");
      // Both the first R and the wrong U are on the error stack
      expect(tracker.state.recoveryMoves).toEqual(["U'", "R'"]);
    });
  });

  describe("error recovery", () => {
    it("enters recovering mode on wrong move", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("L"); // wrong
      const state = tracker.state;
      expect(state.mode).toBe("recovering");
      expect(state.recoveryMoves).toEqual(["L'"]);
    });

    it("exits recovering mode when fix move is performed", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("L"); // wrong
      tracker.onMove("L'"); // fix
      const state = tracker.state;
      expect(state.mode).toBe("tracking");
      expect(state.recoveryMoves).toEqual([]);
      expect(state.scrambleMoves[0].completed).toBe(false); // still at position 0
    });

    it("stacks multiple wrong moves", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("L"); // wrong
      tracker.onMove("D"); // wrong again
      const state = tracker.state;
      expect(state.mode).toBe("recovering");
      expect(state.recoveryMoves).toEqual(["D'", "L'"]);
    });

    it("pops recovery moves one at a time", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("L"); // wrong
      tracker.onMove("D"); // wrong
      tracker.onMove("D'"); // fix top
      expect(tracker.state.recoveryMoves).toEqual(["L'"]);
      tracker.onMove("L'"); // fix remaining
      expect(tracker.state.mode).toBe("tracking");
    });

    it("handles wrong move during recovery", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("L"); // wrong → recovery: ["L'"]
      tracker.onMove("F"); // wrong again → recovery: ["F'", "L'"]
      expect(tracker.state.recoveryMoves).toEqual(["F'", "L'"]);
    });

    it("resumes tracking at same position after recovery", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("R"); // correct, position 1
      tracker.onMove("L"); // wrong
      tracker.onMove("L'"); // fix
      tracker.onMove("U"); // correct, position 2
      expect(tracker.state.scrambleMoves[0].completed).toBe(true);
      expect(tracker.state.scrambleMoves[1].completed).toBe(true);
      expect(tracker.state.scrambleMoves[2].completed).toBe(false);
    });

    it("handles double move inversion correctly", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("U2"); // wrong
      expect(tracker.state.recoveryMoves).toEqual(["U2"]);
    });
  });

  describe("state listener", () => {
    it("emits state changes on each move", () => {
      const tracker = new ScrambleTracker("R U");
      const states: string[] = [];
      tracker.addStateListener((state) => states.push(state.mode));

      tracker.onMove("R"); // tracking
      tracker.onMove("L"); // recovering
      tracker.onMove("L'"); // tracking
      tracker.onMove("U"); // tracking (complete)

      expect(states).toEqual(["tracking", "recovering", "tracking", "tracking"]);
    });
  });
});
