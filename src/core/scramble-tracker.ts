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
    console.log("[ScrambleTracker] scramble string:", JSON.stringify(scramble));
    console.log("[ScrambleTracker] parsed moves:", this.moves.map(m => JSON.stringify(m)));
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
    console.log("[ScrambleTracker] onMove called with:", JSON.stringify(move));
    console.log("[ScrambleTracker] expected move:", JSON.stringify(this.moves[this.position]));
    console.log("[ScrambleTracker] move char codes:", [...move].map(c => c.charCodeAt(0)));
    console.log("[ScrambleTracker] expected char codes:", this.position < this.moves.length ? [...this.moves[this.position]].map(c => c.charCodeAt(0)) : "N/A");
    console.log("[ScrambleTracker] match?", move === this.moves[this.position]);
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
