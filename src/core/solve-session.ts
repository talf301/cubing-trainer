import type { KPattern } from "cubing/kpuzzle";

export type SolvePhase = "idle" | "scrambling" | "ready" | "solving" | "solved";

export interface TimestampedMove {
  move: string;
  timestamp: number; // ms relative to solve start
}

export class SolveSession {
  private _phase: SolvePhase = "idle";
  private _scramble: string = "";
  private expectedState: KPattern | null = null;
  private _moves: TimestampedMove[] = [];
  private solveStartTime: number = 0;
  private solveEndTime: number = 0;
  private phaseListeners = new Set<(phase: SolvePhase) => void>();

  get phase(): SolvePhase {
    return this._phase;
  }

  get scramble(): string {
    return this._scramble;
  }

  get moves(): readonly TimestampedMove[] {
    return this._moves;
  }

  get duration(): number {
    if (this._phase !== "solved") return 0;
    return this.solveEndTime - this.solveStartTime;
  }

  get startTime(): number {
    return this.solveStartTime;
  }

  get endTime(): number {
    return this.solveEndTime;
  }

  startScramble(scramble: string, expectedState: KPattern): void {
    this._scramble = scramble;
    this.expectedState = expectedState;
    this._moves = [];
    this.solveStartTime = 0;
    this.solveEndTime = 0;
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

    const isSolved = stateAfterMove.experimentalIsSolved({
      ignorePuzzleOrientation: true,
      ignoreCenterOrientation: true,
    });

    if (isSolved) {
      this.solveEndTime = timestamp;
      this.setPhase("solved");
    }
  }

  reset(): void {
    this._phase = "idle";
    this._scramble = "";
    this.expectedState = null;
    this._moves = [];
    this.solveStartTime = 0;
    this.solveEndTime = 0;
  }

  addPhaseListener(callback: (phase: SolvePhase) => void): void {
    this.phaseListeners.add(callback);
  }

  removePhaseListener(callback: (phase: SolvePhase) => void): void {
    this.phaseListeners.delete(callback);
  }

  private setPhase(phase: SolvePhase): void {
    this._phase = phase;
    for (const listener of this.phaseListeners) {
      listener(phase);
    }
  }
}
