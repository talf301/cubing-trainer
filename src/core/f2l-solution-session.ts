import { Alg } from "cubing/alg";
import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import { buildFaceGeometry, isCrossSolved, type FaceGeometry } from "./cfop-segmenter";
import { F2L_CASES, type F2LCaseDefinition } from "./f2l-cases";
import { conjugateAlgByZ2 } from "./move-utils";

// ─── Types ───────────────────────────────────────────────────────────

export type F2LSessionPhase = "idle" | "presenting" | "solving" | "review";

export interface F2LAttemptResult {
  caseName: string;
  time: number; // ms
  moveCount: number;
  optimal: boolean; // moveCount <= shortest algorithm move count
  shortestMoveCount: number;
  algorithms: string[];
}

export type F2LPhaseListener = (phase: F2LSessionPhase) => void;
export type F2LResultListener = (result: F2LAttemptResult) => void;

/**
 * Stats for a single case, used by the case selector.
 */
export interface F2LCaseStats {
  caseName: string;
  attemptCount: number;
  /** Average of top-5% times (ms). 0 if no attempts. */
  top5AvgTime: number;
}

/**
 * Interface for the store dependency. The real F2LSolutionStore implements this.
 */
export interface F2LSolutionStoreInterface {
  addAttempt(attempt: {
    id: string;
    caseName: string;
    time: number;
    moveCount: number;
    timestamp: number;
  }): Promise<void>;
  getAttemptsByCase(caseName: string): Promise<{ time: number }[]>;
  getAllAttempts(): Promise<{ caseName: string; time: number }[]>;
}

// ─── FR Slot checking ────────────────────────────────────────────────

const CROSS_FACE_IDX = 0; // U face (white) in cubing.js native frame

/**
 * Check if the FL slot (front-left in native frame) corner and edge are in
 * their home positions with correct orientation. This corresponds to the
 * user's FR slot after z2 conjugation (z2 swaps R↔L, U↔D).
 *
 * Cross face = U (white in native frame = user's D/bottom).
 * FL corner is the corner shared by U, F, L faces.
 * FL edge is the equator edge shared by F, L faces.
 */
function isTargetSlotSolved(pattern: KPattern, geometry: FaceGeometry): boolean {
  // FL corner: intersection of U-face corners, F-face corners, and L-face corners
  const uCorners = new Set(geometry.faceCorners[CROSS_FACE_IDX]); // U=0
  const fCorners = new Set(geometry.faceCorners[2]); // F=2
  const lCorners = new Set(geometry.faceCorners[1]); // L=1

  let flCornerPos = -1;
  for (const pos of uCorners) {
    if (fCorners.has(pos) && lCorners.has(pos)) {
      flCornerPos = pos;
      break;
    }
  }

  const corners = pattern.patternData["CORNERS"];
  if (corners.pieces[flCornerPos] !== flCornerPos || corners.orientation[flCornerPos] !== 0) {
    return false;
  }

  // FL edge: equator edge at intersection of F and L faces, not on U or D
  const uEdges = new Set(geometry.faceEdges[0]); // U=0
  const dEdges = new Set(geometry.faceEdges[5]); // D=5
  const fEdges = new Set(geometry.faceEdges[2]);
  const lEdges = new Set(geometry.faceEdges[1]);

  let flEdgePos = -1;
  for (const pos of fEdges) {
    if (lEdges.has(pos) && !uEdges.has(pos) && !dEdges.has(pos)) {
      flEdgePos = pos;
      break;
    }
  }

  const edges = pattern.patternData["EDGES"];
  if (edges.pieces[flEdgePos] !== flEdgePos || edges.orientation[flEdgePos] !== 0) {
    return false;
  }

  return true;
}

// ─── Case selection ──────────────────────────────────────────────────

/**
 * Select the next F2L case using weighted random selection.
 * Zero-attempt cases get maximum weight. Others weighted by top-5% avg time.
 */
export function selectF2LCase(stats: F2LCaseStats[]): string {
  // Build stats map
  const statsMap = new Map(stats.map((s) => [s.caseName, s]));

  // Cases with no attempts get max weight
  const unattempted: string[] = [];
  const attempted: F2LCaseStats[] = [];

  for (const c of F2L_CASES) {
    const s = statsMap.get(c.name);
    if (!s || s.attemptCount === 0) {
      unattempted.push(c.name);
    } else {
      attempted.push(s);
    }
  }

  // If there are unattempted cases, pick one at random (they all have max weight)
  if (unattempted.length > 0) {
    return unattempted[Math.floor(Math.random() * unattempted.length)];
  }

  // All cases attempted — weight by top-5% avg time (slower = higher weight)
  if (attempted.length === 0) {
    // Fallback: random from all cases
    return F2L_CASES[Math.floor(Math.random() * F2L_CASES.length)].name;
  }

  const times = attempted.map((s) => s.top5AvgTime);
  const minTime = Math.min(...times);
  const maxTime = Math.max(...times);
  const range = maxTime - minTime;

  const weights = attempted.map((s) => {
    if (range === 0) return 1;
    // Normalize to 0-1, slower = higher weight, with epsilon floor
    return Math.max((s.top5AvgTime - minTime) / range, 0.05);
  });

  const total = weights.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;
  for (let i = 0; i < attempted.length; i++) {
    r -= weights[i];
    if (r <= 0) return attempted[i].caseName;
  }
  return attempted[attempted.length - 1].caseName;
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Count moves in a canonical algorithm string. */
function countAlgMoves(alg: string): number {
  return alg.trim().split(/\s+/).filter(Boolean).length;
}

// ─── Cached puzzle assets ────────────────────────────────────────────

let cachedKpuzzle: KPuzzle | null = null;
let cachedGeometry: FaceGeometry | null = null;

async function getAssets(): Promise<{ kpuzzle: KPuzzle; geometry: FaceGeometry }> {
  if (!cachedKpuzzle) {
    cachedKpuzzle = await cube3x3x3.kpuzzle();
  }
  if (!cachedGeometry) {
    cachedGeometry = buildFaceGeometry(cachedKpuzzle);
  }
  return { kpuzzle: cachedKpuzzle, geometry: cachedGeometry };
}

// ─── Auto-advance delay ──────────────────────────────────────────────

const AUTO_ADVANCE_DELAY = 2000; // ms

// ─── Session ─────────────────────────────────────────────────────────

/**
 * F2LSolutionSession manages a drill loop for F2L case solutions.
 *
 * State machine: idle → presenting → solving → review → presenting → ...
 *
 * The session presents F2L cases by computing the case state (solved cube
 * with the inverse of the canonical algorithm applied), and the user
 * executes the solution on their smart cube. Moves are applied to a virtual
 * KPattern and the FR slot is checked for completion.
 *
 * Listener-based: register phase and result listeners for reactive updates.
 */
export class F2LSolutionSession {
  private _phase: F2LSessionPhase = "idle";
  private _currentCase: F2LCaseDefinition | null = null;
  private _caseState: KPattern | null = null; // virtual state tracking moves
  private _moveCount = 0;
  private _solveStartTime = 0;
  private _solveEndTime = 0;
  private _lastResult: F2LAttemptResult | null = null;
  private _autoAdvanceTimer: ReturnType<typeof setTimeout> | null = null;

  private phaseListeners = new Set<F2LPhaseListener>();
  private resultListeners = new Set<F2LResultListener>();

  private store: F2LSolutionStoreInterface | null;

  constructor(store?: F2LSolutionStoreInterface) {
    this.store = store ?? null;
  }

  get phase(): F2LSessionPhase {
    return this._phase;
  }

  get currentCase(): F2LCaseDefinition | null {
    return this._currentCase;
  }

  get caseState(): KPattern | null {
    return this._caseState;
  }

  get lastResult(): F2LAttemptResult | null {
    return this._lastResult;
  }

  // ── Lifecycle ────────────────────────────────────────────────────

  /**
   * Present a specific F2L case. Transitions idle/review → presenting.
   * Computes the virtual cube state by applying the inverse algorithm to solved state.
   */
  async presentCase(caseName: string): Promise<void> {
    if (this._phase !== "idle" && this._phase !== "review") return;
    this.clearAutoAdvance();

    const caseDef = F2L_CASES.find((c) => c.name === caseName);
    if (!caseDef) throw new Error(`Unknown F2L case: ${caseName}`);

    const { kpuzzle, geometry } = await getAssets();
    const solved = kpuzzle.defaultPattern();

    // The user holds the cube yellow-up (z2-flipped from cubing.js's native
    // white-up frame). When they execute the stored algorithm in their frame,
    // the GAN cube reports z2-conjugated moves (R↔L, U↔D swapped). So the
    // scramble must be the conjugate of inverse(algorithm) — that way the
    // user's conjugated alg cancels it and brings the physical state back to
    // solved, which passes the FR-slot + D-cross completion checks.
    const inverseAlg = new Alg(caseDef.algorithms[0]).invert().toString();
    const conjugatedInverseAlg = conjugateAlgByZ2(inverseAlg);
    const caseState = solved.applyAlg(conjugatedInverseAlg);

    // Guard: skip if the setup results in an already-solved FR slot + cross
    if (isTargetSlotSolved(caseState, geometry) && isCrossSolved(caseState, geometry, CROSS_FACE_IDX)) {
      return;
    }

    this._caseState = caseState;
    this._currentCase = caseDef;
    this._moveCount = 0;
    this._solveStartTime = 0;
    this._solveEndTime = 0;
    this._lastResult = null;

    this.setPhase("presenting");
  }

  /**
   * Feed a move from the smart cube. In presenting phase, the first move
   * starts the timer and transitions to solving. In solving phase, the move
   * is applied to the virtual state and the FR slot is checked.
   */
  async onMove(move: string, timestamp: number): Promise<void> {
    if (this._phase === "presenting") {
      // First move starts timer
      this._solveStartTime = timestamp;
      this.setPhase("solving");
    }

    if (this._phase !== "solving") return;

    // Apply move to virtual state
    this._caseState = this._caseState!.applyMove(move);
    this._moveCount++;

    // Check if FR slot is solved AND cross is still intact
    const { geometry } = await getAssets();
    if (isTargetSlotSolved(this._caseState, geometry) && isCrossSolved(this._caseState, geometry, CROSS_FACE_IDX)) {
      this._solveEndTime = timestamp;
      await this.completeSolve();
    }
  }

  /**
   * Skip the current case without recording an attempt.
   * Available during presenting or solving phases.
   */
  skip(): void {
    if (this._phase !== "presenting" && this._phase !== "solving") return;
    this.clearAutoAdvance();
    this._currentCase = null;
    this._caseState = null;
    this.setPhase("idle");
  }

  /**
   * Re-present the current case. Available during presenting, solving,
   * or review phases. Resets move count and timer without changing the case.
   */
  async retry(): Promise<void> {
    const caseName = this._currentCase?.name;
    if (!caseName) return;
    if (this._phase !== "presenting" && this._phase !== "solving" && this._phase !== "review") return;
    this.clearAutoAdvance();
    // Force back to idle so presentCase accepts the transition
    this._phase = "idle";
    await this.presentCase(caseName);
  }

  /**
   * Advance from review to idle. Used when auto-advance doesn't apply
   * (suboptimal solve) or to manually advance past auto-advance.
   */
  next(): void {
    if (this._phase !== "review") return;
    this.clearAutoAdvance();
    this.setPhase("idle");
  }

  /**
   * Reset the session to idle, clearing all state.
   */
  reset(): void {
    this.clearAutoAdvance();
    this._phase = "idle";
    this._currentCase = null;
    this._caseState = null;
    this._moveCount = 0;
    this._solveStartTime = 0;
    this._solveEndTime = 0;
    this._lastResult = null;
  }

  // ── Listeners ────────────────────────────────────────────────────

  addPhaseListener(listener: F2LPhaseListener): void {
    this.phaseListeners.add(listener);
  }

  removePhaseListener(listener: F2LPhaseListener): void {
    this.phaseListeners.delete(listener);
  }

  addResultListener(listener: F2LResultListener): void {
    this.resultListeners.add(listener);
  }

  removeResultListener(listener: F2LResultListener): void {
    this.resultListeners.delete(listener);
  }

  // ── Private ──────────────────────────────────────────────────────

  private async completeSolve(): Promise<void> {
    const caseDef = this._currentCase!;
    const time = this._solveEndTime - this._solveStartTime;
    const shortestMoveCount = Math.min(...caseDef.algorithms.map(countAlgMoves));
    const optimal = this._moveCount <= shortestMoveCount;

    const result: F2LAttemptResult = {
      caseName: caseDef.name,
      time,
      moveCount: this._moveCount,
      optimal,
      shortestMoveCount,
      algorithms: caseDef.algorithms,
    };
    this._lastResult = result;

    // Persist attempt
    if (this.store) {
      await this.store.addAttempt({
        id: crypto.randomUUID(),
        caseName: caseDef.name,
        time,
        moveCount: this._moveCount,
        timestamp: Date.now(),
      });
    }

    this.setPhase("review");

    // Emit result
    for (const listener of this.resultListeners) {
      listener(result);
    }

    // Auto-advance on optimal solve
    if (optimal) {
      this._autoAdvanceTimer = setTimeout(() => {
        if (this._phase === "review") {
          this.setPhase("idle");
        }
      }, AUTO_ADVANCE_DELAY);
    }
  }

  private clearAutoAdvance(): void {
    if (this._autoAdvanceTimer !== null) {
      clearTimeout(this._autoAdvanceTimer);
      this._autoAdvanceTimer = null;
    }
  }

  private setPhase(phase: F2LSessionPhase): void {
    this._phase = phase;
    for (const listener of this.phaseListeners) {
      listener(phase);
    }
  }
}
