# Cross Trainer Fixes & Shared MoveGuide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four bugs: cross face default (D→U), cross solver hanging, and double-move matching in both PLL learn session and ScrambleTracker recovery.

**Architecture:** Extract shared move helpers into `move-utils.ts`, build a `MoveGuide` class for stateful move tracking with double-move expansion and error recovery collapsing, then integrate it into `ScrambleTracker` and `PllLearnSession`. Separately fix cross face default and add solver debugging.

**Tech Stack:** TypeScript, Vitest, cubing.js (`Move` class from `cubing/alg`)

**Spec:** `docs/superpowers/specs/2026-03-23-cross-trainer-fixes-design.md`

---

### Task 1: Create `move-utils.ts` shared helpers

**Files:**
- Create: `src/core/move-utils.ts`
- Create: `src/core/__tests__/move-utils.test.ts`

- [ ] **Step 1: Write tests for move-utils**

```typescript
// src/core/__tests__/move-utils.test.ts
import { describe, it, expect } from "vitest";
import {
  invertMove,
  moveFamily,
  moveAmount,
  normalizeAmount,
  isDoubleMove,
  isQuarterTurnOf,
  buildMoveString,
} from "../move-utils";

describe("move-utils", () => {
  describe("invertMove", () => {
    it("inverts R to R'", () => expect(invertMove("R")).toBe("R'"));
    it("inverts R' to R", () => expect(invertMove("R'")).toBe("R"));
    it("inverts R2 to R2 (self-inverse)", () => expect(invertMove("R2")).toBe("R2"));
    it("inverts U to U'", () => expect(invertMove("U")).toBe("U'"));
    it("inverts D' to D", () => expect(invertMove("D'")).toBe("D"));
  });

  describe("moveFamily", () => {
    it("extracts R from R", () => expect(moveFamily("R")).toBe("R"));
    it("extracts R from R'", () => expect(moveFamily("R'")).toBe("R"));
    it("extracts R from R2", () => expect(moveFamily("R2")).toBe("R"));
    it("extracts U from U", () => expect(moveFamily("U")).toBe("U"));
  });

  describe("moveAmount", () => {
    it("R is 1", () => expect(moveAmount("R")).toBe(1));
    it("R' is -1", () => expect(moveAmount("R'")).toBe(-1));
    it("R2 is 2", () => expect(moveAmount("R2")).toBe(2));
    it("U is 1", () => expect(moveAmount("U")).toBe(1));
  });

  describe("normalizeAmount", () => {
    it("0 stays 0", () => expect(normalizeAmount(0)).toBe(0));
    it("1 stays 1", () => expect(normalizeAmount(1)).toBe(1));
    it("2 stays 2", () => expect(normalizeAmount(2)).toBe(2));
    it("3 becomes -1", () => expect(normalizeAmount(3)).toBe(-1));
    it("4 becomes 0", () => expect(normalizeAmount(4)).toBe(0));
    it("-1 stays -1", () => expect(normalizeAmount(-1)).toBe(-1));
    it("-2 stays 2", () => expect(normalizeAmount(-2)).toBe(2));
  });

  describe("isDoubleMove", () => {
    it("R2 is double", () => expect(isDoubleMove("R2")).toBe(true));
    it("R is not double", () => expect(isDoubleMove("R")).toBe(false));
    it("R' is not double", () => expect(isDoubleMove("R'")).toBe(false));
  });

  describe("isQuarterTurnOf", () => {
    it("R is quarter turn of R2", () => expect(isQuarterTurnOf("R2", "R")).toBe(true));
    it("R' is quarter turn of R2", () => expect(isQuarterTurnOf("R2", "R'")).toBe(true));
    it("U is not quarter turn of R2", () => expect(isQuarterTurnOf("R2", "U")).toBe(false));
  });

  describe("buildMoveString", () => {
    it("R + 1 = R", () => expect(buildMoveString("R", 1)).toBe("R"));
    it("R + -1 = R'", () => expect(buildMoveString("R", -1)).toBe("R'"));
    it("R + 2 = R2", () => expect(buildMoveString("R", 2)).toBe("R2"));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/__tests__/move-utils.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement move-utils**

```typescript
// src/core/move-utils.ts
import { Move } from "cubing/alg";

export function invertMove(moveStr: string): string {
  const inverted = new Move(moveStr).invert().toString();
  // cubing.js represents the inverse of U2 as "U2'" but U2 is self-inverse
  if (inverted.endsWith("2'")) {
    return inverted.slice(0, -1);
  }
  return inverted;
}

export function moveFamily(moveStr: string): string {
  return new Move(moveStr).family;
}

export function moveAmount(moveStr: string): number {
  return new Move(moveStr).amount;
}

export function normalizeAmount(amount: number): number {
  const mod = ((amount % 4) + 4) % 4;
  if (mod === 3) return -1;
  if (mod === 0) return 0;
  return mod;
}

export function isDoubleMove(moveStr: string): boolean {
  return moveStr.endsWith("2");
}

export function isQuarterTurnOf(doubleMove: string, move: string): boolean {
  const face = moveFamily(doubleMove);
  return moveFamily(move) === face && !isDoubleMove(move);
}

export function buildMoveString(face: string, amount: number): string {
  return new Move(face, amount).toString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/__tests__/move-utils.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/move-utils.ts src/core/__tests__/move-utils.test.ts
git commit -m "feat: add shared move-utils helpers"
```

---

### Task 2: Create `MoveGuide` class

**Files:**
- Create: `src/core/move-guide.ts`
- Create: `src/core/__tests__/move-guide.test.ts`
- Read: `src/core/move-utils.ts` (from Task 1)

- [ ] **Step 1: Write MoveGuide tests**

```typescript
// src/core/__tests__/move-guide.test.ts
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
      expect(guide.state.position).toBe(0); // not yet advanced
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
      guide.onMove("R'"); // wrong — must match first direction
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
      guide.onMove("R"); // first half of R2
      guide.onMove("U"); // wrong — expected second R
      expect(guide.state.mode).toBe("recovering");
      // Both R and U are errors; R+U are different faces so both stay
      expect(guide.state.recoveryMoves).toEqual(["U'", "R'"]);
    });
  });

  describe("recovery mode", () => {
    it("single wrong move, undo with inverse", () => {
      const guide = new MoveGuide(["R", "U"]);
      guide.onMove("L"); // wrong
      guide.onMove("L'"); // undo
      expect(guide.state.mode).toBe("tracking");
      expect(guide.state.position).toBe(0); // back where we were
    });

    it("collapses same-face errors: R+R becomes R2", () => {
      const guide = new MoveGuide(["U", "F"]);
      guide.onMove("R"); // wrong
      expect(guide.state.recoveryMoves).toEqual(["R'"]);
      guide.onMove("R"); // another wrong R — collapses with first
      expect(guide.state.recoveryMoves).toEqual(["R2"]);
    });

    it("collapses three same-face moves to R'", () => {
      const guide = new MoveGuide(["U"]);
      guide.onMove("R");
      guide.onMove("R");
      guide.onMove("R");
      // 3 R's = R' on stack (mod 4: amount 3 → -1)
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
      guide.onMove("R"); // stack = [R2], recovery = undo R2
      expect(guide.state.recoveryMoves).toEqual(["R2"]);
      // Undo R2 with two quarter turns
      guide.onMove("R");
      expect(guide.state.pendingHalfMove).toBe(true);
      guide.onMove("R");
      expect(guide.state.mode).toBe("tracking");
    });

    it("wrong move during recovery pushes onto stack", () => {
      const guide = new MoveGuide(["U"]);
      guide.onMove("R"); // wrong → stack = [R]
      guide.onMove("D"); // wrong again (different face) → stack = [R, D]
      expect(guide.state.recoveryMoves).toEqual(["D'", "R'"]);
    });

    it("wrong move during recovery collapses with top if same face", () => {
      const guide = new MoveGuide(["U"]);
      guide.onMove("R"); // wrong → stack = [R]
      guide.onMove("D"); // wrong → stack = [R, D]
      guide.onMove("D"); // same face as top → stack = [R, D2]
      expect(guide.state.recoveryMoves).toEqual(["D2", "R'"]);
    });

    it("handles multi-item stack recovery one at a time", () => {
      const guide = new MoveGuide(["U"]);
      guide.onMove("R"); // stack = [R]
      guide.onMove("D"); // stack = [R, D]
      // Undo D first
      guide.onMove("D'");
      expect(guide.state.recoveryMoves).toEqual(["R'"]);
      // Undo R
      guide.onMove("R'");
      expect(guide.state.mode).toBe("tracking");
    });
  });

  describe("complete sequence with mixed singles and doubles", () => {
    it("tracks R2 U' F2 with quarter turns", () => {
      const guide = new MoveGuide(["R2", "U'", "F2"]);
      guide.onMove("R");
      guide.onMove("R"); // R2 done
      guide.onMove("U'"); // U' done
      guide.onMove("F'");
      guide.onMove("F'"); // F2 done
      expect(guide.state.isComplete).toBe(true);
    });
  });

  describe("reset", () => {
    it("returns to position 0, tracking mode, clears all state", () => {
      const guide = new MoveGuide(["R", "U"]);
      guide.onMove("R");
      guide.onMove("L"); // error
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/__tests__/move-guide.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement MoveGuide**

```typescript
// src/core/move-guide.ts
import {
  invertMove,
  moveFamily,
  moveAmount,
  normalizeAmount,
  isDoubleMove,
  isQuarterTurnOf,
  buildMoveString,
} from "./move-utils";

export interface MoveGuideState {
  mode: "tracking" | "recovering";
  position: number;
  isComplete: boolean;
  pendingHalfMove: boolean;
  recoveryMoves: string[];
}

interface ErrorEntry {
  face: string;
  amount: number; // normalized: -1, 1, or 2
}

export class MoveGuide {
  private moves: string[];
  private _position: number = 0;
  private errorStack: ErrorEntry[] = [];
  private _pendingHalfMove: string | null = null; // stores the quarter turn direction
  private _pendingRecoveryHalf: string | null = null; // for double-move recovery

  constructor(moves: string[]) {
    this.moves = moves;
  }

  get state(): MoveGuideState {
    return {
      mode: this.errorStack.length > 0 ? "recovering" : "tracking",
      position: this._position,
      isComplete: this._position >= this.moves.length && this.errorStack.length === 0,
      pendingHalfMove: this._pendingHalfMove !== null || this._pendingRecoveryHalf !== null,
      recoveryMoves: this.errorStack
        .slice()
        .reverse()
        .map((e) => invertMove(buildMoveString(e.face, e.amount))),
    };
  }

  get expectedMove(): string | null {
    if (this.errorStack.length > 0) {
      const top = this.errorStack[this.errorStack.length - 1];
      return invertMove(buildMoveString(top.face, top.amount));
    }
    if (this._position >= this.moves.length) return null;
    return this.moves[this._position];
  }

  onMove(move: string): void {
    if (this.errorStack.length > 0) {
      this.handleRecoveryMove(move);
    } else {
      this.handleTrackingMove(move);
    }
  }

  reset(): void {
    this._position = 0;
    this.errorStack = [];
    this._pendingHalfMove = null;
    this._pendingRecoveryHalf = null;
  }

  private handleTrackingMove(move: string): void {
    if (this._position >= this.moves.length) return;

    const expected = this.moves[this._position];

    if (this._pendingHalfMove !== null) {
      if (move === this._pendingHalfMove) {
        // Second quarter turn matches — double move complete
        this._pendingHalfMove = null;
        this._position++;
      } else {
        // Wrong second half — both are errors
        const firstMove = this._pendingHalfMove;
        this._pendingHalfMove = null;
        this.pushError(firstMove);
        this.pushError(move);
      }
    } else if (move === expected) {
      this._position++;
    } else if (isDoubleMove(expected) && isQuarterTurnOf(expected, move)) {
      this._pendingHalfMove = move;
    } else {
      this.pushError(move);
    }
  }

  private handleRecoveryMove(move: string): void {
    const top = this.errorStack[this.errorStack.length - 1];
    const requiredMove = invertMove(buildMoveString(top.face, top.amount));

    if (this._pendingRecoveryHalf !== null) {
      if (move === this._pendingRecoveryHalf) {
        // Second quarter turn completes the double-move undo
        this._pendingRecoveryHalf = null;
        this.errorStack.pop();
      } else {
        // Wrong second half — the pending half is a new error, plus this move
        const firstMove = this._pendingRecoveryHalf;
        this._pendingRecoveryHalf = null;
        this.pushError(firstMove);
        this.pushError(move);
      }
    } else if (move === requiredMove) {
      this.errorStack.pop();
    } else if (isDoubleMove(requiredMove) && isQuarterTurnOf(requiredMove, move)) {
      this._pendingRecoveryHalf = move;
    } else {
      this.pushError(move);
    }
  }

  private pushError(move: string): void {
    const face = moveFamily(move);
    const amount = moveAmount(move);

    if (this.errorStack.length > 0) {
      const top = this.errorStack[this.errorStack.length - 1];
      if (top.face === face) {
        const combined = normalizeAmount(top.amount + amount);
        if (combined === 0) {
          this.errorStack.pop();
        } else {
          top.amount = combined;
        }
        return;
      }
    }

    this.errorStack.push({ face, amount: normalizeAmount(amount) });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/__tests__/move-guide.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/move-guide.ts src/core/__tests__/move-guide.test.ts
git commit -m "feat: add MoveGuide class for stateful move tracking with double-move support"
```

---

### Task 3: Integrate MoveGuide into ScrambleTracker

**Files:**
- Modify: `src/core/scramble-tracker.ts`
- Modify: `src/core/__tests__/scramble-tracker.test.ts`
- Read: `src/core/move-guide.ts` (from Task 2)

- [ ] **Step 1: Add new recovery-collapsing tests to ScrambleTracker**

Add these tests to the existing "error recovery" describe block in `src/core/__tests__/scramble-tracker.test.ts`:

```typescript
    it("collapses same-face recovery moves (R+R becomes undo R2)", () => {
      const tracker = new ScrambleTracker("U F");
      tracker.onMove("R"); // wrong
      tracker.onMove("R"); // same face — collapses to R2
      expect(tracker.state.recoveryMoves).toEqual(["R2"]);
    });

    it("four same-face wrong moves cancel out and return to tracking", () => {
      const tracker = new ScrambleTracker("U F");
      tracker.onMove("R");
      tracker.onMove("R");
      tracker.onMove("R");
      tracker.onMove("R");
      expect(tracker.state.mode).toBe("tracking");
      expect(tracker.state.recoveryMoves).toEqual([]);
    });

    it("recovery from double-move error accepts two quarter turns as undo", () => {
      const tracker = new ScrambleTracker("U F");
      tracker.onMove("R");
      tracker.onMove("R"); // stack = R2
      expect(tracker.state.recoveryMoves).toEqual(["R2"]);
      tracker.onMove("R"); // first half of undo R2
      tracker.onMove("R"); // second half
      expect(tracker.state.mode).toBe("tracking");
    });
```

- [ ] **Step 2: Run tests to verify the new tests fail (existing tests still pass)**

Run: `npx vitest run src/core/__tests__/scramble-tracker.test.ts`
Expected: 3 new tests FAIL, existing tests PASS

- [ ] **Step 3: Rewrite ScrambleTracker to use MoveGuide**

Replace the contents of `src/core/scramble-tracker.ts`:

```typescript
// src/core/scramble-tracker.ts
import { MoveGuide } from "./move-guide";

export interface ScrambleTrackerState {
  mode: "tracking" | "recovering";
  scrambleMoves: { move: string; completed: boolean }[];
  recoveryMoves: string[];
  isComplete: boolean;
}

export class ScrambleTracker {
  private moves: string[];
  private guide: MoveGuide;
  private listeners = new Set<(state: ScrambleTrackerState) => void>();

  constructor(scramble: string) {
    this.moves = scramble.split(/\s+/).filter((s) => s.length > 0);
    this.guide = new MoveGuide(this.moves);
  }

  get state(): ScrambleTrackerState {
    const guideState = this.guide.state;
    return {
      mode: guideState.mode,
      scrambleMoves: this.moves.map((move, i) => ({
        move,
        completed: i < guideState.position,
      })),
      recoveryMoves: guideState.recoveryMoves,
      isComplete: guideState.isComplete,
    };
  }

  onMove(move: string): void {
    this.guide.onMove(move);
    this.emit();
  }

  addStateListener(cb: (state: ScrambleTrackerState) => void): void {
    this.listeners.add(cb);
  }

  removeStateListener(cb: (state: ScrambleTrackerState) => void): void {
    this.listeners.delete(cb);
  }

  private emit(): void {
    const s = this.state;
    for (const cb of this.listeners) {
      cb(s);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run src/core/__tests__/scramble-tracker.test.ts`
Expected: All tests PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
git add src/core/scramble-tracker.ts src/core/__tests__/scramble-tracker.test.ts
git commit -m "refactor: rewrite ScrambleTracker to use MoveGuide for recovery collapsing"
```

---

### Task 4: Integrate MoveGuide into PllLearnSession

**Files:**
- Modify: `src/core/pll-learn-session.ts`
- Modify: `src/core/__tests__/pll-learn-session.test.ts`
- Modify: `src/features/pll-trainer/usePllTrainer.ts`
- Modify: `src/features/pll-trainer/PllTrainer.tsx`
- Read: `src/core/move-guide.ts` (from Task 2)

- [ ] **Step 1: Add double-move and updated needsUndo tests**

Add these tests to the existing describe blocks in `src/core/__tests__/pll-learn-session.test.ts`:

In the "practice mode" describe block:

```typescript
    it("handles double move in algorithm via two quarter turns", () => {
      const session = new PllLearnSession();
      // Aa perm has R2 at the end: R' U R' D2 R U' R' D2 R2
      session.startPractice("Aa");
      const moves = [...session.faceMoves];
      // Find the R2 position
      const r2Idx = moves.indexOf("R2");
      expect(r2Idx).toBeGreaterThan(-1);

      // Do all moves up to R2
      for (let i = 0; i < r2Idx; i++) {
        session.onMove(moves[i]);
      }
      expect(session.position).toBe(r2Idx);
      expect(session.expectedMove).toBe("R2");

      // Do R2 as two quarter turns
      session.onMove("R");
      session.onMove("R");
      expect(session.position).toBe(r2Idx + 1);
    });

    it("needsUndo returns string array for recovery moves", () => {
      const session = new PllLearnSession();
      session.startPractice("T");
      session.onMove("U"); // wrong — expected R
      expect(session.needsUndo).toEqual(["U'"]);
    });

    it("needsUndo returns null when no undo needed", () => {
      const session = new PllLearnSession();
      session.startPractice("T");
      expect(session.needsUndo).toBeNull();
    });
```

Update existing tests that check `needsUndo` against a string to check against a string array:

- `"wrong move requires undo before continuing"`:
  - Line 73: change `expect(session.needsUndo).toBe("U'")` to `expect(session.needsUndo).toEqual(["U'"])`
  - Line 77-78: The wrong undo attempt (`session.onMove("R")`) is no longer silently ignored — MoveGuide pushes it onto the error stack. Update the assertion from `expect(session.needsUndo).toBe("U'")` to `expect(session.needsUndo).toEqual(["R'", "U'"])` and add `session.onMove("R'")` before the correct undo to clear the R from the stack. The full updated test:

```typescript
    it("wrong move requires undo before continuing", () => {
      const session = new PllLearnSession();
      session.startPractice("T");
      expect(session.expectedMove).toBe("R");

      // Wrong move
      session.onMove("U");
      expect(session.needsUndo).toEqual(["U'"]);
      expect(session.expectedMove).toBeNull();

      // Wrong undo attempt — now pushed onto error stack
      session.onMove("R");
      expect(session.needsUndo).toEqual(["R'", "U'"]);

      // Undo the wrong attempt first
      session.onMove("R'");
      expect(session.needsUndo).toEqual(["U'"]);

      // Correct undo
      session.onMove("U'");
      expect(session.needsUndo).toBeNull();
      expect(session.position).toBe(0);
      expect(session.expectedMove).toBe("R");
    });
```

- `"wrong move with prime requires non-prime undo"`: change `expect(session.needsUndo).toBe("R'")` to `expect(session.needsUndo).toEqual(["R'"])`
- `"wrong double move is self-inverse for undo"`: change `expect(session.needsUndo).toBe("D2")` to `expect(session.needsUndo).toEqual(["D2"])`

- [ ] **Step 2: Run tests to verify the new/updated tests fail**

Run: `npx vitest run src/core/__tests__/pll-learn-session.test.ts`
Expected: Updated and new tests FAIL

- [ ] **Step 3: Rewrite PllLearnSession to use MoveGuide**

Replace the contents of `src/core/pll-learn-session.ts`:

```typescript
// src/core/pll-learn-session.ts
import { PLL_CASES } from "./pll-cases";
import { MoveGuide } from "./move-guide";

export type LearnPhase = "idle" | "practicing" | "testing" | "passed";

const ROTATION_MOVES = new Set([
  "x", "x'", "x2",
  "y", "y'", "y2",
  "z", "z'", "z2",
]);

function parseFaceMoves(algorithm: string): string[] {
  return algorithm
    .trim()
    .split(/\s+/)
    .filter((m) => !ROTATION_MOVES.has(m));
}

export class PllLearnSession {
  private _phase: LearnPhase = "idle";
  private _caseName: string = "";
  private _faceMoves: string[] = [];
  private _reps: number = 0;
  private _completions: number = 0;
  private guide: MoveGuide | null = null;
  private phaseListeners = new Set<(phase: LearnPhase) => void>();

  static readonly TEST_COMPLETIONS_REQUIRED = 5;

  get phase(): LearnPhase {
    return this._phase;
  }

  get caseName(): string {
    return this._caseName;
  }

  get faceMoves(): readonly string[] {
    return this._faceMoves;
  }

  get position(): number {
    return this.guide?.state.position ?? 0;
  }

  get reps(): number {
    return this._reps;
  }

  get completions(): number {
    return this._completions;
  }

  get needsUndo(): string[] | null {
    if (!this.guide) return null;
    const state = this.guide.state;
    if (state.mode === "recovering") {
      return state.recoveryMoves;
    }
    return null;
  }

  get expectedMove(): string | null {
    if (!this.guide) return null;
    if (this.guide.state.mode === "recovering") return null;
    return this.guide.expectedMove;
  }

  startPractice(caseName: string): void {
    const caseData = PLL_CASES[caseName];
    if (!caseData) {
      throw new Error(`Unknown PLL case: ${caseName}`);
    }
    this._caseName = caseName;
    this._faceMoves = parseFaceMoves(caseData.algorithm);
    this._reps = 0;
    this._completions = 0;
    this.guide = new MoveGuide(this._faceMoves);
    this.setPhase("practicing");
  }

  startTest(): void {
    if (this._phase !== "practicing") return;
    this._completions = 0;
    this.guide?.reset();
    this.setPhase("testing");
  }

  onMove(move: string): void {
    if (this._phase !== "practicing" && this._phase !== "testing") return;
    if (!this.guide) return;

    this.guide.onMove(move);

    if (this.guide.state.isComplete) {
      this.onAlgorithmCompleted();
    }
  }

  private onAlgorithmCompleted(): void {
    if (this._phase === "practicing") {
      this._reps++;
      this.guide?.reset();
    } else if (this._phase === "testing") {
      this._completions++;
      if (this._completions >= PllLearnSession.TEST_COMPLETIONS_REQUIRED) {
        this.setPhase("passed");
      } else {
        this.guide?.reset();
      }
    }
  }

  reset(): void {
    this._phase = "idle";
    this._caseName = "";
    this._faceMoves = [];
    this._reps = 0;
    this._completions = 0;
    this.guide = null;
  }

  addPhaseListener(callback: (phase: LearnPhase) => void): void {
    this.phaseListeners.add(callback);
  }

  removePhaseListener(callback: (phase: LearnPhase) => void): void {
    this.phaseListeners.delete(callback);
  }

  private setPhase(phase: LearnPhase): void {
    this._phase = phase;
    for (const listener of this.phaseListeners) {
      listener(phase);
    }
  }
}
```

- [ ] **Step 4: Run PllLearnSession tests**

Run: `npx vitest run src/core/__tests__/pll-learn-session.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Update usePllTrainer.ts for new needsUndo type**

In `src/features/pll-trainer/usePllTrainer.ts`:

Change line 64:
```typescript
const [learnNeedsUndo, setLearnNeedsUndo] = useState<string[] | null>(null);
```

Change line 180 (`setLearnNeedsUndo(null)` is fine, no change needed).

- [ ] **Step 6: Update PllTrainer.tsx undo display**

In `src/features/pll-trainer/PllTrainer.tsx`, find both occurrences of:
```tsx
{learnNeedsUndo && (
  <p className="text-amber-400">
    Wrong move! Undo with: <span className="font-mono font-bold">{learnNeedsUndo}</span>
  </p>
)}
```

Replace each with:
```tsx
{learnNeedsUndo && (
  <p className="text-amber-400">
    Wrong move! Undo with: <span className="font-mono font-bold">{learnNeedsUndo.join(" ")}</span>
  </p>
)}
```

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/core/pll-learn-session.ts src/core/__tests__/pll-learn-session.test.ts src/features/pll-trainer/usePllTrainer.ts src/features/pll-trainer/PllTrainer.tsx
git commit -m "refactor: rewrite PllLearnSession to use MoveGuide for double-move support"
```

---

### Task 5: Refactor undo-alg.ts to use shared helpers

**Files:**
- Modify: `src/core/undo-alg.ts`
- Read: `src/core/__tests__/undo-alg.test.ts` (existing tests, no changes needed)

- [ ] **Step 1: Rewrite undo-alg.ts to import from move-utils**

Replace the contents of `src/core/undo-alg.ts`:

```typescript
// src/core/undo-alg.ts
import { Alg, Move } from "cubing/alg";
import { normalizeAmount } from "./move-utils";

function moveFamily(move: Move): string {
  const outer = move.outerLayer;
  const inner = move.innerLayer;
  let key = move.family;
  if (outer != null) key = `${outer}-${key}`;
  if (inner != null) key = `${inner}-${key}`;
  return key;
}

export function computeUndoAlg(moves: string[]): Alg {
  if (moves.length === 0) return new Alg();

  const inverted: Move[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    inverted.push(new Move(moves[i]).invert());
  }

  const collapsed: Move[] = [];
  for (const move of inverted) {
    if (collapsed.length > 0) {
      const prev = collapsed[collapsed.length - 1];
      if (moveFamily(prev) === moveFamily(move)) {
        const combined = normalizeAmount(prev.amount + move.amount);
        if (combined === 0) {
          collapsed.pop();
        } else {
          collapsed[collapsed.length - 1] = new Move(move.quantum, combined);
        }
        continue;
      }
    }
    collapsed.push(move);
  }

  return new Alg(collapsed);
}
```

Note: `undo-alg.ts` keeps its own `moveFamily` that works with `Move` objects (not strings) and handles outer/inner layers. The `move-utils.ts` version works with strings and is simpler. They serve different purposes — `undo-alg` needs the `Move`-object version for `computeUndoAlg`'s collapsing logic. We only import `normalizeAmount` to avoid duplication of that specific function.

- [ ] **Step 2: Run undo-alg tests to verify nothing broke**

Run: `npx vitest run src/core/__tests__/undo-alg.test.ts`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/core/undo-alg.ts
git commit -m "refactor: import normalizeAmount from move-utils in undo-alg"
```

---

### Task 6: Fix cross face default (D → U)

**Files:**
- Modify: `src/core/cross-solver.ts:69-72`
- Modify: `src/core/cross-trainer-session.ts:32,75,147`
- Modify: `src/core/__tests__/cross-solver.test.ts:66-83`
- Modify: `src/core/__tests__/cross-trainer-session.test.ts:258-270,253`

- [ ] **Step 1: Update default face assertion tests**

In `src/core/__tests__/cross-solver.test.ts`, update the "defaults to D-face cross" test:

Change test name to `"defaults to U-face cross"`. Change the face index from `5` (D) to `0` (U). Update the variable name from `dCrossEdges` to `uCrossEdges` and `geometry.faceEdges[5]` to `geometry.faceEdges[0]`:

```typescript
  it("defaults to U-face cross", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    mockSolveTwips.mockResolvedValue(new Alg(""));

    await solveOptimalCross(kpuzzle, solved);

    const [, , options] = mockSolveTwips.mock.calls[0];
    const targetPattern = options!.targetPattern!;
    const edges = targetPattern.patternData["EDGES"];
    const geometry = buildFaceGeometry(kpuzzle);
    const uCrossEdges = new Set(geometry.faceEdges[0]);

    // U-face cross edges should be constrained
    for (const pos of uCrossEdges) {
      expect(edges.orientationMod![pos]).toBe(0);
    }
  });
```

In `src/core/__tests__/cross-trainer-session.test.ts`:

Update `"defaults to D-face cross"` test (line 258):
- Change test name to `"defaults to U-face cross"`
- Change `expect(session.crossFace).toBe("D")` to `expect(session.crossFace).toBe("U")`
- Change the `expect(mockSolveOptimalCross).toHaveBeenCalledWith(kpuzzle, expect.anything(), "D")` to `"U"`

Update `"reset returns to idle and clears state"` test (line 253):
- Change `expect(session.crossFace).toBe("D")` to `expect(session.crossFace).toBe("U")`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/core/__tests__/cross-solver.test.ts src/core/__tests__/cross-trainer-session.test.ts`
Expected: Updated tests FAIL (old default "D" doesn't match new assertion "U")

- [ ] **Step 3: Change defaults in source files**

In `src/core/cross-solver.ts` line 72, change:
```typescript
  crossFace: string = "D",
```
to:
```typescript
  crossFace: string = "U",
```

Update the JSDoc on line 67 from `"Defaults to D-face cross."` to `"Defaults to U-face cross."`.

In `src/core/cross-trainer-session.ts`:
- Line 32: change `private _crossFace: string = "D"` to `private _crossFace: string = "U"`
- Line 75: change `crossFace: string = "D"` to `crossFace: string = "U"`
- Line 147: change `this._crossFace = "D"` to `this._crossFace = "U"`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/__tests__/cross-solver.test.ts src/core/__tests__/cross-trainer-session.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/cross-solver.ts src/core/cross-trainer-session.ts src/core/__tests__/cross-solver.test.ts src/core/__tests__/cross-trainer-session.test.ts
git commit -m "fix: change cross trainer default face from D (yellow) to U (white)"
```

---

### Task 7: Add cross solver debugging and timeout

**Files:**
- Modify: `src/core/cross-solver.ts:69-82`
- Modify: `src/core/__tests__/cross-solver.test.ts`
- Modify: `src/features/training/use-cross-trainer.ts:109`

- [ ] **Step 1: Add timeout test**

Add to `src/core/__tests__/cross-solver.test.ts`:

```typescript
  it("rejects with timeout error if solver takes too long", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    // Mock a solver that never resolves
    mockSolveTwips.mockReturnValue(new Promise(() => {}));

    await expect(
      solveOptimalCross(kpuzzle, solved, "U", { timeoutMs: 50 }),
    ).rejects.toThrow("Cross solver timed out");
  });

  it("uses default 30s timeout", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    mockSolveTwips.mockResolvedValue(new Alg("R"));

    // Just verify it resolves normally with default timeout
    const result = await solveOptimalCross(kpuzzle, solved, "U");
    expect(result.toString()).toBe("R");
  });
```

- [ ] **Step 2: Run tests to verify the timeout test fails**

Run: `npx vitest run src/core/__tests__/cross-solver.test.ts`
Expected: Timeout test FAILS (no options parameter yet)

- [ ] **Step 3: Add timeout and logging to solveOptimalCross**

Update `src/core/cross-solver.ts` — replace the `solveOptimalCross` function:

```typescript
export interface CrossSolverOptions {
  timeoutMs?: number;
}

export async function solveOptimalCross(
  kpuzzle: KPuzzle,
  pattern: KPattern,
  crossFace: string = "U",
  options: CrossSolverOptions = {},
): Promise<Alg> {
  const { timeoutMs = 30_000 } = options;

  const faceIdx = FACE_INDICES[crossFace];
  if (faceIdx === undefined) {
    throw new Error(`Invalid cross face: ${crossFace}`);
  }

  const targetPattern = buildCrossTarget(kpuzzle, faceIdx);

  console.log(`[cross-solver] Starting solve for ${crossFace}-face cross`);
  const startTime = performance.now();

  const solverPromise = experimentalSolveTwips(kpuzzle, pattern, {
    targetPattern,
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error("Cross solver timed out")), timeoutMs);
  });

  const result = await Promise.race([solverPromise, timeoutPromise]);

  const elapsed = (performance.now() - startTime).toFixed(0);
  console.log(`[cross-solver] Solved in ${elapsed}ms: ${result.toString()}`);

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/core/__tests__/cross-solver.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Add error handling in use-cross-trainer.ts**

In `src/features/training/use-cross-trainer.ts`, find line 109:
```typescript
session.getResult().then(setResult);
```

Replace with:
```typescript
session.getResult().then(setResult).catch((err) => {
  console.error("[cross-trainer] Failed to get result:", err);
  setResult(null);
});
```

This prevents an unhandled promise rejection when the solver times out. The UI will show no optimal solution rather than hanging.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 7: Commit**

```bash
git add src/core/cross-solver.ts src/core/__tests__/cross-solver.test.ts src/features/training/use-cross-trainer.ts
git commit -m "fix: add timeout and diagnostic logging to cross solver"
```
