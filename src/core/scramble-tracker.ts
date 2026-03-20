import { Move } from "cubing/alg";

export interface ScrambleTrackerState {
  mode: "tracking" | "recovering";
  scrambleMoves: { move: string; completed: boolean }[];
  recoveryMoves: string[];
  isComplete: boolean;
}

export class ScrambleTracker {
  private moves: string[];
  private position: number = 0;
  private errorStack: string[] = [];
  private pendingHalfMove: string | null = null;
  private listeners = new Set<(state: ScrambleTrackerState) => void>();

  constructor(scramble: string) {
    this.moves = scramble.split(/\s+/).filter((s) => s.length > 0);
  }

  get state(): ScrambleTrackerState {
    return {
      mode: this.errorStack.length > 0 ? "recovering" : "tracking",
      scrambleMoves: this.moves.map((move, i) => ({
        move,
        completed: i < this.position,
      })),
      recoveryMoves: [...this.errorStack].reverse().map((m) => invertMove(m)),
      isComplete: this.position >= this.moves.length,
    };
  }

  onMove(move: string): void {
    if (this.errorStack.length > 0) {
      // In recovery mode — error stack contains actual physical moves (quarter turns)
      const expectedFix = invertMove(this.errorStack[this.errorStack.length - 1]);
      if (move === expectedFix) {
        this.errorStack.pop();
      } else {
        this.errorStack.push(move);
      }
    } else if (this.position < this.moves.length) {
      // In tracking mode
      const expected = this.moves[this.position];

      if (this.pendingHalfMove !== null) {
        // Waiting for second quarter turn of a double move (e.g., "R2")
        if (move === this.pendingHalfMove) {
          // Second quarter turn matches the first — completes the double move
          this.pendingHalfMove = null;
          this.position++;
        } else {
          // Wrong — the first quarter turn and this move are both errors
          const firstMove = this.pendingHalfMove;
          this.pendingHalfMove = null;
          this.errorStack.push(firstMove);
          this.errorStack.push(move);
        }
      } else if (move === expected) {
        // Exact match (single quarter turns, primes, or cube-reported doubles)
        this.position++;
      } else if (isDoubleMove(expected) && isQuarterTurnOf(expected, move)) {
        // First quarter turn of a double move (R or R' both start R2)
        this.pendingHalfMove = move;
      } else {
        this.errorStack.push(move);
      }
    }
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

function isDoubleMove(moveStr: string): boolean {
  return moveStr.endsWith("2");
}

function isQuarterTurnOf(doubleMove: string, move: string): boolean {
  // "R2" can be done as R+R or R'+R'
  const face = doubleMove.charAt(0);
  return move === face || move === face + "'";
}

function invertMove(moveStr: string): string {
  const inverted = new Move(moveStr).invert().toString();
  // cubing.js represents the inverse of U2 as "U2'" but U2 is self-inverse;
  // normalize by stripping a trailing apostrophe from double moves.
  if (inverted.endsWith("2'")) {
    return inverted.slice(0, -1);
  }
  return inverted;
}
