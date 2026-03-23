import { describe, it, expect } from "vitest";
import { MoveGuide } from "../move-guide";

describe("MoveGuide", () => {
  describe("tracking mode", () => {
    it("starts at position 0 in tracking mode", () => {
      const guide = new MoveGuide(["R", "U", "F"]);
      expect(guide.state.mode).toBe("tracking");
      expect(guide.state.position).toBe(0);
      expect(guide.state.isComplete).toBe(false);
      expect(guide.expectedMove).toBe("R");
    });

    it("exact match advances position", () => {
      const guide = new MoveGuide(["R", "U"]);
      guide.onMove("R");
      expect(guide.state.position).toBe(1);
      expect(guide.expectedMove).toBe("U");
    });

    it("reports complete when all moves matched", () => {
      const guide = new MoveGuide(["R", "U"]);
      guide.onMove("R");
      guide.onMove("U");
      expect(guide.state.isComplete).toBe(true);
      expect(guide.expectedMove).toBeNull();
    });

    it("double move matched by two same-direction quarter turns (R+R)", () => {
      const guide = new MoveGuide(["R2", "U"]);
      guide.onMove("R");
      expect(guide.state.pendingHalfMove).toBe(true);
      expect(guide.state.position).toBe(0);
      guide.onMove("R");
      expect(guide.state.pendingHalfMove).toBe(false);
      expect(guide.state.position).toBe(1);
      expect(guide.expectedMove).toBe("U");
    });

    it("double move matched by two opposite-direction quarter turns (R'+R')", () => {
      const guide = new MoveGuide(["R2", "U"]);
      guide.onMove("R'");
      guide.onMove("R'");
      expect(guide.state.position).toBe(1);
      expect(guide.state.mode).toBe("tracking");
    });

    it("rejects mixed directions for double move (R then R')", () => {
      const guide = new MoveGuide(["R2"]);
      guide.onMove("R");
      guide.onMove("R'");
      expect(guide.state.mode).toBe("recovering");
    });

    it("wrong move enters recovery mode", () => {
      const guide = new MoveGuide(["R", "U"]);
      guide.onMove("L");
      expect(guide.state.mode).toBe("recovering");
      expect(guide.state.recoveryMoves).toEqual(["L'"]);
      expect(guide.expectedMove).toBe("L'");
    });

    it("wrong move during pending half pushes both moves onto error stack", () => {
      const guide = new MoveGuide(["R2", "U"]);
      guide.onMove("R");
      guide.onMove("U");
      expect(guide.state.mode).toBe("recovering");
      expect(guide.state.recoveryMoves).toEqual(["U'", "R'"]);
    });
  });

  describe("recovery mode", () => {
    it("single wrong move, undo with inverse", () => {
      const guide = new MoveGuide(["R", "U"]);
      guide.onMove("L");
      guide.onMove("L'");
      expect(guide.state.mode).toBe("tracking");
      expect(guide.state.position).toBe(0);
    });

    it("collapses same-face errors: R+R becomes R2", () => {
      const guide = new MoveGuide(["U", "F"]);
      guide.onMove("R");
      expect(guide.state.recoveryMoves).toEqual(["R'"]);
      guide.onMove("R");
      expect(guide.state.recoveryMoves).toEqual(["R2"]);
    });

    it("collapses three same-face moves to R'", () => {
      const guide = new MoveGuide(["U"]);
      guide.onMove("R");
      guide.onMove("R");
      guide.onMove("R");
      expect(guide.state.recoveryMoves).toEqual(["R"]);
    });

    it("four same-face moves cancel out, return to tracking", () => {
      const guide = new MoveGuide(["U"]);
      guide.onMove("R");
      guide.onMove("R");
      guide.onMove("R");
      guide.onMove("R");
      expect(guide.state.mode).toBe("tracking");
      expect(guide.state.recoveryMoves).toEqual([]);
      expect(guide.state.position).toBe(0);
    });

    it("recovery from double-move undo accepts two quarter turns", () => {
      const guide = new MoveGuide(["U"]);
      guide.onMove("R");
      guide.onMove("R");
      expect(guide.state.recoveryMoves).toEqual(["R2"]);
      guide.onMove("R");
      expect(guide.state.pendingHalfMove).toBe(true);
      guide.onMove("R");
      expect(guide.state.mode).toBe("tracking");
    });

    it("wrong move during recovery pushes onto stack", () => {
      const guide = new MoveGuide(["U"]);
      guide.onMove("R");
      guide.onMove("D");
      expect(guide.state.recoveryMoves).toEqual(["D'", "R'"]);
    });

    it("wrong move during recovery collapses with top if same face", () => {
      const guide = new MoveGuide(["U"]);
      guide.onMove("R");
      guide.onMove("D");
      guide.onMove("D");
      expect(guide.state.recoveryMoves).toEqual(["D2", "R'"]);
    });

    it("wrong second half during pending recovery preserves remaining error", () => {
      const guide = new MoveGuide(["U"]);
      // 3 R's = R' error, guide is pending recovery half
      guide.onMove("R");
      guide.onMove("R");
      guide.onMove("R");
      expect(guide.state.recoveryMoves).toEqual(["R"]);
      // Wrong move instead of completing recovery
      guide.onMove("U");
      // R' error still there, plus new U error on top
      expect(guide.state.recoveryMoves).toEqual(["U'", "R"]);
    });

    it("handles multi-item stack recovery one at a time", () => {
      const guide = new MoveGuide(["U"]);
      guide.onMove("R");
      guide.onMove("D");
      guide.onMove("D'");
      expect(guide.state.recoveryMoves).toEqual(["R'"]);
      guide.onMove("R'");
      expect(guide.state.mode).toBe("tracking");
    });
  });

  describe("complete sequence with mixed singles and doubles", () => {
    it("tracks R2 U' F2 with quarter turns", () => {
      const guide = new MoveGuide(["R2", "U'", "F2"]);
      guide.onMove("R");
      guide.onMove("R");
      guide.onMove("U'");
      guide.onMove("F'");
      guide.onMove("F'");
      expect(guide.state.isComplete).toBe(true);
    });
  });

  describe("reset", () => {
    it("returns to position 0, tracking mode, clears all state", () => {
      const guide = new MoveGuide(["R", "U"]);
      guide.onMove("R");
      guide.onMove("L");
      guide.reset();
      expect(guide.state.mode).toBe("tracking");
      expect(guide.state.position).toBe(0);
      expect(guide.state.isComplete).toBe(false);
      expect(guide.state.pendingHalfMove).toBe(false);
      expect(guide.state.recoveryMoves).toEqual([]);
      expect(guide.expectedMove).toBe("R");
    });
  });
});
