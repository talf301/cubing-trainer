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
