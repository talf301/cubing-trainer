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
