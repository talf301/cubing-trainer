import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import type { Alg } from "cubing/alg";
import { buildFaceGeometry, isCrossSolved } from "./cfop-segmenter";
import type { FaceGeometry } from "./cfop-segmenter";
import { solveOptimalCross } from "./cross-solver";
import { computeUndoAlg } from "./undo-alg";
import type { TimestampedMove } from "./solve-session";

export type CrossTrainerPhase =
  | "idle"
  | "scrambling"
  | "ready"
  | "solving"
  | "review";

export interface CrossTrainerResult {
  scramble: string;
  crossFace: string;
  moves: readonly TimestampedMove[];
  duration: number;
  optimalSolution: Alg;
  undoAlg: Alg;
}

const FACE_INDICES: Record<string, number> = {
  U: 0, L: 1, F: 2, R: 3, B: 4, D: 5,
};

export class CrossTrainerSession {
  private _phase: CrossTrainerPhase = "idle";
  private _scramble: string = "";
  private _crossFace: string = "D";
  private expectedState: KPattern | null = null;
  private _moves: TimestampedMove[] = [];
  private solveStartTime: number = 0;
  private solveEndTime: number = 0;
  private phaseListeners = new Set<(phase: CrossTrainerPhase) => void>();

  private kpuzzle: KPuzzle | null = null;
  private geometry: FaceGeometry | null = null;
  private solverPromise: Promise<Alg> | null = null;

  get phase(): CrossTrainerPhase {
    return this._phase;
  }

  get scramble(): string {
    return this._scramble;
  }

  get crossFace(): string {
    return this._crossFace;
  }

  get moves(): readonly TimestampedMove[] {
    return this._moves;
  }

  get duration(): number {
    if (this._phase !== "review") return 0;
    return this.solveEndTime - this.solveStartTime;
  }

  get startTime(): number {
    return this.solveStartTime;
  }

  get endTime(): number {
    return this.solveEndTime;
  }

  startScramble(
    scramble: string,
    expectedState: KPattern,
    kpuzzle: KPuzzle,
    crossFace: string = "D",
  ): void {
    this._scramble = scramble;
    this.expectedState = expectedState;
    this.kpuzzle = kpuzzle;
    this._crossFace = crossFace;
    this._moves = [];
    this.solveStartTime = 0;
    this.solveEndTime = 0;

    // Kick off optimal cross solver immediately
    const scrambledPattern = kpuzzle.defaultPattern().applyAlg(scramble);
    this.solverPromise = solveOptimalCross(kpuzzle, scrambledPattern, crossFace);

    this.geometry = buildFaceGeometry(kpuzzle);
    this.setPhase("scrambling");
  }

  onCubeState(currentState: KPattern): void {
    if (this._phase !== "scrambling") return;
    if (!this.expectedState) return;

    if (currentState.isIdentical(this.expectedState)) {
      this.setPhase("ready");
    }
  }

  onMove(move: string, timestamp: number, stateAfterMove: KPattern): void {
    if (this._phase === "ready") {
      this.solveStartTime = timestamp;
      this.setPhase("solving");
    }

    if (this._phase !== "solving") return;

    this._moves.push({
      move,
      timestamp: timestamp - this.solveStartTime,
    });

    const faceIdx = FACE_INDICES[this._crossFace];
    if (faceIdx !== undefined && this.geometry) {
      if (isCrossSolved(stateAfterMove, this.geometry, faceIdx)) {
        this.solveEndTime = timestamp;
        this.setPhase("review");
      }
    }
  }

  async getResult(): Promise<CrossTrainerResult> {
    if (this._phase !== "review") {
      throw new Error("Cannot get result outside of review phase");
    }
    if (!this.solverPromise) {
      throw new Error("No solver promise available");
    }

    const optimalSolution = await this.solverPromise;
    const undoAlg = computeUndoAlg(this._moves.map((m) => m.move));

    return {
      scramble: this._scramble,
      crossFace: this._crossFace,
      moves: this._moves,
      duration: this.duration,
      optimalSolution,
      undoAlg,
    };
  }

  reset(): void {
    this._phase = "idle";
    this._scramble = "";
    this._crossFace = "D";
    this.expectedState = null;
    this._moves = [];
    this.solveStartTime = 0;
    this.solveEndTime = 0;
    this.kpuzzle = null;
    this.geometry = null;
    this.solverPromise = null;
  }

  addPhaseListener(callback: (phase: CrossTrainerPhase) => void): void {
    this.phaseListeners.add(callback);
  }

  removePhaseListener(callback: (phase: CrossTrainerPhase) => void): void {
    this.phaseListeners.delete(callback);
  }

  private setPhase(phase: CrossTrainerPhase): void {
    this._phase = phase;
    for (const listener of this.phaseListeners) {
      listener(phase);
    }
  }
}
