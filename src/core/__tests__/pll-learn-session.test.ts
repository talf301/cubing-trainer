import { describe, it, expect, vi } from "vitest";
import { PllLearnSession } from "../pll-learn-session";

describe("PllLearnSession", () => {
  describe("initialization", () => {
    it("starts in idle phase", () => {
      const session = new PllLearnSession();
      expect(session.phase).toBe("idle");
      expect(session.caseName).toBe("");
      expect(session.faceMoves).toEqual([]);
    });

    it("throws on unknown case", () => {
      const session = new PllLearnSession();
      expect(() => session.startPractice("Bogus")).toThrow("Unknown PLL case");
    });
  });

  describe("rotation handling", () => {
    it("strips rotation moves from algorithm", () => {
      const session = new PllLearnSession();
      // Aa perm: "x R' U R' D2 R U' R' D2 R2 x'"
      session.startPractice("Aa");
      expect(session.faceMoves).toEqual([
        "R'", "U", "R'", "D2", "R", "U'", "R'", "D2", "R2",
      ]);
    });

    it("strips y rotations", () => {
      const session = new PllLearnSession();
      // V perm: "R' U R' U' y R' F' R2 U' R' U R' F R F"
      session.startPractice("V");
      expect(session.faceMoves).not.toContain("y");
      expect(session.faceMoves[0]).toBe("R'");
    });

    it("strips x' rotations at end of algorithm", () => {
      const session = new PllLearnSession();
      // E perm: "x' R U' R' D R U R' D' R U R' D R U' R' D' x"
      session.startPractice("E");
      expect(session.faceMoves).not.toContain("x'");
      expect(session.faceMoves).not.toContain("x");
    });
  });

  describe("practice mode", () => {
    it("transitions to practicing on startPractice", () => {
      const session = new PllLearnSession();
      session.startPractice("T");
      expect(session.phase).toBe("practicing");
      expect(session.caseName).toBe("T");
      expect(session.position).toBe(0);
      expect(session.reps).toBe(0);
    });

    it("correct move advances position", () => {
      const session = new PllLearnSession();
      // T perm: R U R' U' R' F R2 U' R' U' R U R' F'
      session.startPractice("T");
      expect(session.expectedMove).toBe("R");
      session.onMove("R");
      expect(session.position).toBe(1);
      expect(session.expectedMove).toBe("U");
    });

    it("wrong move requires undo before continuing", () => {
      const session = new PllLearnSession();
      session.startPractice("T");
      expect(session.expectedMove).toBe("R");

      // Wrong move
      session.onMove("U");
      expect(session.needsUndo).toBe("U'");
      expect(session.expectedMove).toBeNull();

      // Wrong undo attempt — ignored
      session.onMove("R");
      expect(session.needsUndo).toBe("U'");

      // Correct undo
      session.onMove("U'");
      expect(session.needsUndo).toBeNull();
      expect(session.position).toBe(0); // still at same position
      expect(session.expectedMove).toBe("R");
    });

    it("wrong move with prime requires non-prime undo", () => {
      const session = new PllLearnSession();
      session.startPractice("T");
      session.onMove("R"); // correct
      session.onMove("U"); // correct
      session.onMove("R'"); // correct
      session.onMove("U'"); // correct

      // Next expected: R'
      expect(session.expectedMove).toBe("R'");
      session.onMove("R"); // wrong — inverse of R is R'
      expect(session.needsUndo).toBe("R'");
    });

    it("wrong double move is self-inverse for undo", () => {
      const session = new PllLearnSession();
      session.startPractice("T");
      session.onMove("D2"); // wrong move
      expect(session.needsUndo).toBe("D2");
    });

    it("increments rep counter on algorithm completion", () => {
      const session = new PllLearnSession();
      // Use Jb for shorter alg: R U R' F' R U R' U' R' F R2 U' R' (13 moves, no rotations)
      session.startPractice("Jb");
      const moves = [...session.faceMoves];

      // Complete the algorithm
      for (const move of moves) {
        session.onMove(move);
      }
      expect(session.reps).toBe(1);
      expect(session.position).toBe(0); // reset for next rep
      expect(session.phase).toBe("practicing");
    });

    it("counts multiple reps", () => {
      const session = new PllLearnSession();
      session.startPractice("Jb");
      const moves = [...session.faceMoves];

      for (let rep = 0; rep < 3; rep++) {
        for (const move of moves) {
          session.onMove(move);
        }
      }
      expect(session.reps).toBe(3);
      expect(session.phase).toBe("practicing");
    });

    it("ignores moves in idle phase", () => {
      const session = new PllLearnSession();
      session.onMove("R"); // should not throw
      expect(session.position).toBe(0);
    });
  });

  describe("test mode", () => {
    it("transitions from practicing to testing", () => {
      const session = new PllLearnSession();
      session.startPractice("T");
      session.startTest();
      expect(session.phase).toBe("testing");
      expect(session.position).toBe(0);
      expect(session.completions).toBe(0);
    });

    it("does not transition to testing from idle", () => {
      const session = new PllLearnSession();
      session.startTest();
      expect(session.phase).toBe("idle");
    });

    it("5 completions transitions to passed", () => {
      const session = new PllLearnSession();
      session.startPractice("Jb");
      session.startTest();
      const moves = [...session.faceMoves];

      for (let i = 0; i < 5; i++) {
        for (const move of moves) {
          session.onMove(move);
        }
      }
      expect(session.completions).toBe(5);
      expect(session.phase).toBe("passed");
    });

    it("4 completions stays in testing", () => {
      const session = new PllLearnSession();
      session.startPractice("Jb");
      session.startTest();
      const moves = [...session.faceMoves];

      for (let i = 0; i < 4; i++) {
        for (const move of moves) {
          session.onMove(move);
        }
      }
      expect(session.completions).toBe(4);
      expect(session.phase).toBe("testing");
    });

    it("wrong moves with undo correction still count toward completion", () => {
      const session = new PllLearnSession();
      session.startPractice("Jb");
      session.startTest();
      const moves = [...session.faceMoves];

      // Do 4 clean completions
      for (let i = 0; i < 4; i++) {
        for (const move of moves) {
          session.onMove(move);
        }
      }

      // 5th completion with a mistake
      session.onMove("U"); // wrong — expected R
      session.onMove("U'"); // undo
      // Now do the real algorithm
      for (const move of moves) {
        session.onMove(move);
      }

      expect(session.completions).toBe(5);
      expect(session.phase).toBe("passed");
    });

    it("ignores moves after passed", () => {
      const session = new PllLearnSession();
      session.startPractice("Jb");
      session.startTest();
      const moves = [...session.faceMoves];

      for (let i = 0; i < 5; i++) {
        for (const move of moves) {
          session.onMove(move);
        }
      }
      expect(session.phase).toBe("passed");

      // Moves after passed are ignored
      const posBefore = session.position;
      session.onMove("R");
      expect(session.position).toBe(posBefore);
    });
  });

  describe("phase transitions", () => {
    it("fires phase listener on practice start", () => {
      const session = new PllLearnSession();
      const listener = vi.fn();
      session.addPhaseListener(listener);
      session.startPractice("T");
      expect(listener).toHaveBeenCalledWith("practicing");
    });

    it("fires phase listener on test start", () => {
      const session = new PllLearnSession();
      const listener = vi.fn();
      session.startPractice("T");
      session.addPhaseListener(listener);
      session.startTest();
      expect(listener).toHaveBeenCalledWith("testing");
    });

    it("fires phase listener on passed", () => {
      const session = new PllLearnSession();
      const listener = vi.fn();
      session.startPractice("Jb");
      session.startTest();
      session.addPhaseListener(listener);
      const moves = [...session.faceMoves];

      for (let i = 0; i < 5; i++) {
        for (const move of moves) {
          session.onMove(move);
        }
      }
      expect(listener).toHaveBeenCalledWith("passed");
    });

    it("removePhaseListener stops notifications", () => {
      const session = new PllLearnSession();
      const listener = vi.fn();
      session.addPhaseListener(listener);
      session.removePhaseListener(listener);
      session.startPractice("T");
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("reset", () => {
    it("resets all state back to idle", () => {
      const session = new PllLearnSession();
      session.startPractice("T");
      session.onMove("R");
      session.reset();

      expect(session.phase).toBe("idle");
      expect(session.caseName).toBe("");
      expect(session.faceMoves).toEqual([]);
      expect(session.position).toBe(0);
      expect(session.reps).toBe(0);
      expect(session.completions).toBe(0);
      expect(session.needsUndo).toBeNull();
    });
  });
});
