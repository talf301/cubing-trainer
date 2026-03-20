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
      // In recovery mode
      const expectedFix = invertMove(this.errorStack[this.errorStack.length - 1]);
      if (move === expectedFix) {
        this.errorStack.pop();
      } else {
        this.errorStack.push(move);
      }
    } else {
      // In tracking mode
      if (this.position < this.moves.length && move === this.moves[this.position]) {
        this.position++;
      } else if (this.position < this.moves.length) {
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

function invertMove(moveStr: string): string {
  const inverted = new Move(moveStr).invert().toString();
  // cubing.js represents the inverse of U2 as "U2'" but U2 is self-inverse;
  // normalize by stripping a trailing apostrophe from double moves.
  if (inverted.endsWith("2'")) {
    return inverted.slice(0, -1);
  }
  return inverted;
}
