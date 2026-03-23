import { PLL_CASES } from "./pll-cases";

export type LearnPhase = "idle" | "practicing" | "testing" | "passed";

/** Rotation moves that smart cubes cannot detect */
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
  private _position: number = 0;
  private _reps: number = 0;
  private _completions: number = 0;
  private _needsUndo: string | null = null; // the move to undo (inverse of wrong move)
  private phaseListeners = new Set<(phase: LearnPhase) => void>();

  static readonly TEST_COMPLETIONS_REQUIRED = 5;

  get phase(): LearnPhase {
    return this._phase;
  }

  get caseName(): string {
    return this._caseName;
  }

  /** The face-turn-only move sequence (rotations stripped) */
  get faceMoves(): readonly string[] {
    return this._faceMoves;
  }

  /** Current position in the move sequence */
  get position(): number {
    return this._position;
  }

  /** Reps completed in practice mode */
  get reps(): number {
    return this._reps;
  }

  /** Completions in test mode */
  get completions(): number {
    return this._completions;
  }

  /** If non-null, the user must perform this undo move before continuing */
  get needsUndo(): string | null {
    return this._needsUndo;
  }

  /** The next expected move, or null if waiting for undo or no moves left */
  get expectedMove(): string | null {
    if (this._needsUndo) return null;
    if (this._position >= this._faceMoves.length) return null;
    return this._faceMoves[this._position];
  }

  /** Start learning a PLL case in practice mode */
  startPractice(caseName: string): void {
    const caseData = PLL_CASES[caseName];
    if (!caseData) {
      throw new Error(`Unknown PLL case: ${caseName}`);
    }
    this._caseName = caseName;
    this._faceMoves = parseFaceMoves(caseData.algorithm);
    this._position = 0;
    this._reps = 0;
    this._completions = 0;
    this._needsUndo = null;
    this.setPhase("practicing");
  }

  /** Switch to test mode (algorithm hidden, need 5 completions) */
  startTest(): void {
    if (this._phase !== "practicing") return;
    this._position = 0;
    this._completions = 0;
    this._needsUndo = null;
    this.setPhase("testing");
  }

  /** Process a move from the smart cube */
  onMove(move: string): void {
    if (this._phase !== "practicing" && this._phase !== "testing") return;

    // If waiting for an undo move
    if (this._needsUndo) {
      if (move === this._needsUndo) {
        this._needsUndo = null;
      }
      // Ignore wrong undo attempts
      return;
    }

    const expected = this._faceMoves[this._position];
    if (move === expected) {
      this._position++;
      // Check if algorithm completed
      if (this._position >= this._faceMoves.length) {
        this.onAlgorithmCompleted();
      }
    } else {
      // Wrong move — require undo
      this._needsUndo = invertMove(move);
    }
  }

  private onAlgorithmCompleted(): void {
    if (this._phase === "practicing") {
      this._reps++;
      this._position = 0;
    } else if (this._phase === "testing") {
      this._completions++;
      if (this._completions >= PllLearnSession.TEST_COMPLETIONS_REQUIRED) {
        this.setPhase("passed");
      } else {
        this._position = 0;
      }
    }
  }

  reset(): void {
    this._phase = "idle";
    this._caseName = "";
    this._faceMoves = [];
    this._position = 0;
    this._reps = 0;
    this._completions = 0;
    this._needsUndo = null;
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

/** Compute the inverse of a single move */
function invertMove(move: string): string {
  if (move.endsWith("2")) return move; // 180° moves are self-inverse
  if (move.endsWith("'")) return move.slice(0, -1);
  return move + "'";
}
