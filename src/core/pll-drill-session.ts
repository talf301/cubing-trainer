import { Alg } from "cubing/alg";
import type { KPattern } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import type { PllAttempt, PllStatsStore } from "@/lib/pll-stats-store";
import { PLL_CASES } from "./pll-cases";
import { recognizePLL } from "./case-recognizer";

export type DrillPhase =
  | "idle"
  | "selecting"
  | "scrambling"
  | "ready"
  | "solving"
  | "review";

export interface TimestampedMove {
  move: string;
  timestamp: number;
}

/**
 * Interface for the case selector dependency.
 * The real PllCaseSelector will implement this; tests can mock it.
 */
export interface PllCaseSelectorInterface {
  selectCase(): Promise<string>;
}

const AUF_OPTIONS = ["", "U", "U'", "U2"];

// PLL cases that only permute edges (corners stay solved)
const EDGE_ONLY_PLLS = new Set(["H", "Ua", "Ub", "Z"]);
// PLL cases that only permute corners (edges stay solved)
const CORNER_ONLY_PLLS = new Set(["Aa", "Ab", "E"]);

export class PllDrillSession {
  private _phase: DrillPhase = "idle";
  private _currentCase: string | null = null;
  private _scramble: string = "";
  private _moves: TimestampedMove[] = [];
  private _was2Look: boolean = false;
  private _moveCount: number = 0;
  private solveStartTime: number = 0;
  private solveEndTime: number = 0;
  private expectedState: KPattern | null = null;
  private knownCaseNames: Set<string> = new Set();
  private phaseListeners = new Set<(phase: DrillPhase) => void>();

  constructor(
    private statsStore: PllStatsStore,
    private caseSelector: PllCaseSelectorInterface,
  ) {}

  get phase(): DrillPhase {
    return this._phase;
  }

  get currentCase(): string | null {
    return this._currentCase;
  }

  get scramble(): string {
    return this._scramble;
  }

  get moves(): readonly TimestampedMove[] {
    return this._moves;
  }

  get moveCount(): number {
    return this._moveCount;
  }

  get duration(): number {
    if (this.solveEndTime === 0 || this.solveStartTime === 0) return 0;
    return this.solveEndTime - this.solveStartTime;
  }

  get was2Look(): boolean {
    return this._was2Look;
  }

  /**
   * Start the next drill case. Transitions: idle/review → selecting → scrambling.
   * Selects a case, generates a scramble, and computes the expected cube state.
   */
  async startNextCase(): Promise<void> {
    if (this._phase !== "idle" && this._phase !== "review") return;

    this.setPhase("selecting");

    // Cache known cases for 2-look detection
    const knownCases = await this.statsStore.getKnownCases();
    this.knownCaseNames = new Set(knownCases.map((kc) => kc.name));

    // Select a case
    const caseName = await this.caseSelector.selectCase();
    this._currentCase = caseName;

    // Generate scramble: random AUF + inverse algorithm + random AUF
    const caseData = PLL_CASES[caseName];
    const inverseAlg = new Alg(caseData.algorithm).invert().toString();
    const aufPre = AUF_OPTIONS[Math.floor(Math.random() * AUF_OPTIONS.length)];
    const aufPost = AUF_OPTIONS[Math.floor(Math.random() * AUF_OPTIONS.length)];
    const parts = [aufPre, inverseAlg, aufPost].filter((s) => s.length > 0);
    this._scramble = parts.join(" ");

    // Compute expected cube state after scramble
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    this.expectedState = solved.applyAlg(this._scramble);

    // Reset solve state
    this._moves = [];
    this._was2Look = false;
    this._moveCount = 0;
    this.solveStartTime = 0;
    this.solveEndTime = 0;

    this.setPhase("scrambling");
  }

  /**
   * Called when the cube's current state is reported.
   * Transitions: scrambling → ready (when cube matches expected scramble state).
   */
  onCubeState(currentState: KPattern): void {
    if (this._phase !== "scrambling") return;
    if (!this.expectedState) return;

    if (currentState.isIdentical(this.expectedState)) {
      this.setPhase("ready");
    }
  }

  /**
   * Called when a move is detected on the cube.
   * Transitions: ready → solving (first move), solving → review (solved).
   * Also checks for 2-look intermediate states during solving.
   */
  async onMove(
    move: string,
    timestamp: number,
    stateAfterMove: KPattern,
  ): Promise<void> {
    if (this._phase === "ready") {
      this.solveStartTime = timestamp;
      this.setPhase("solving");
    }

    if (this._phase !== "solving") return;

    this._moveCount++;
    this._moves.push({
      move,
      timestamp: timestamp - this.solveStartTime,
    });

    // Check for full solve
    const isSolved = stateAfterMove.experimentalIsSolved({
      ignorePuzzleOrientation: true,
      ignoreCenterOrientation: true,
    });

    if (isSolved) {
      this.solveEndTime = timestamp;
      await this.persistAttempt();
      this.setPhase("review");
      return;
    }

    // Check for 2-look intermediate state (only if case is known)
    if (
      !this._was2Look &&
      this._currentCase &&
      this.knownCaseNames.has(this._currentCase)
    ) {
      await this.check2Look(stateAfterMove);
    }
  }

  addPhaseListener(callback: (phase: DrillPhase) => void): void {
    this.phaseListeners.add(callback);
  }

  removePhaseListener(callback: (phase: DrillPhase) => void): void {
    this.phaseListeners.delete(callback);
  }

  /**
   * Check if the intermediate state indicates a 2-look solve.
   * If the remaining PLL is an edge-only or corner-only case,
   * the user has solved one piece type and still needs the other.
   */
  private async check2Look(state: KPattern): Promise<void> {
    const remaining = await recognizePLL(state, "D");
    if (remaining === null) return;

    if (EDGE_ONLY_PLLS.has(remaining) || CORNER_ONLY_PLLS.has(remaining)) {
      this._was2Look = true;
    }
  }

  private async persistAttempt(): Promise<void> {
    if (!this._currentCase) return;

    const attempt: PllAttempt = {
      id: crypto.randomUUID(),
      caseName: this._currentCase,
      time: this.duration,
      moveCount: this._moveCount,
      was2Look: this._was2Look,
      timestamp: Date.now(),
    };

    await this.statsStore.recordAttempt(attempt);
  }

  private setPhase(phase: DrillPhase): void {
    this._phase = phase;
    for (const listener of this.phaseListeners) {
      listener(phase);
    }
  }
}
