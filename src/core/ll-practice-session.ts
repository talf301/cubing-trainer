import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import {
  buildFaceGeometry,
  isCrossSolved,
  isF2LSolved,
  isOLLSolved,
  type FaceGeometry,
} from "./cfop-segmenter";
import { recognizeOLL, recognizePLL } from "./case-recognizer";

/** Cross face is always D for LL practice */
const CROSS_FACE_IDX = 5;
const CROSS_FACE = "D";

export type LLPracticePhase =
  | "idle"
  | "scrambling"
  | "solving_oll"
  | "solving_pll"
  | "done";

export interface LLPhaseSegment {
  caseName: string;
  recognitionTime: number; // ms before first move in this segment
  executionTime: number;   // ms from first move to segment end
}

export interface LLPracticeCompletion {
  ollSegments: LLPhaseSegment[];
  pllSegments: LLPhaseSegment[];
  ollTime: number;
  pllTime: number;
  totalTime: number;
  timestamp: number;
}

export type LLPracticeCompletionListener = (
  completion: LLPracticeCompletion,
) => void;

export type LLPracticePhaseListener = (phase: LLPracticePhase) => void;

// Cached kpuzzle assets
let cachedKpuzzle: KPuzzle | null = null;
let cachedGeometry: FaceGeometry | null = null;

async function getAssets(): Promise<{
  kpuzzle: KPuzzle;
  geometry: FaceGeometry;
}> {
  if (!cachedKpuzzle) {
    cachedKpuzzle = await cube3x3x3.kpuzzle();
  }
  if (!cachedGeometry) {
    cachedGeometry = buildFaceGeometry(cachedKpuzzle);
  }
  return { kpuzzle: cachedKpuzzle, geometry: cachedGeometry };
}

/**
 * Check if the cube is fully solved (all pieces in home position with 0 orientation).
 */
function isSolved(pattern: KPattern): boolean {
  const edges = pattern.patternData["EDGES"];
  for (let i = 0; i < edges.pieces.length; i++) {
    if (edges.pieces[i] !== i || edges.orientation[i] !== 0) return false;
  }
  const corners = pattern.patternData["CORNERS"];
  for (let i = 0; i < corners.pieces.length; i++) {
    if (corners.pieces[i] !== i || corners.orientation[i] !== 0) return false;
  }
  return true;
}

/**
 * LLPracticeSession tracks cube moves through a full last-layer practice cycle:
 * scramble application → OLL solve → PLL solve → completion.
 *
 * Detects OLL and PLL cases, distinguishes 1-look vs 2-look solves,
 * and breaks down recognition vs execution time for each phase segment.
 */
export class LLPracticeSession {
  private phase: LLPracticePhase = "idle";
  private geometry: FaceGeometry | null = null;
  private initialized = false;

  // Scramble tracking
  private expectedState: KPattern | null = null;

  // OLL phase tracking
  private ollSegmentStart: number | null = null;
  private ollFirstMoveTime: number | null = null;
  private ollSegments: LLPhaseSegment[] = [];
  private f2lBroken = false;
  // The state at the start of the current OLL segment (F2L solved, OLL unsolved)
  // Used to recognize the OLL case being solved.
  private ollSegmentState: KPattern | null = null;

  // PLL phase tracking
  private pllSegmentStart: number | null = null;
  private pllFirstMoveTime: number | null = null;
  private pllSegments: LLPhaseSegment[] = [];
  private pllStartedExecution = false;
  // The state at the start of the current PLL segment (F2L+OLL solved, PLL unsolved)
  private pllSegmentState: KPattern | null = null;

  // Listeners
  private completionListeners = new Set<LLPracticeCompletionListener>();
  private phaseListeners = new Set<LLPracticePhaseListener>();

  private async ensureInit(): Promise<FaceGeometry> {
    if (!this.initialized) {
      const { geometry } = await getAssets();
      this.geometry = geometry;
      this.initialized = true;
    }
    return this.geometry!;
  }

  get currentPhase(): LLPracticePhase {
    return this.phase;
  }

  /**
   * Start a new practice cycle with the given scramble.
   * Transitions from idle/done to scrambling.
   */
  start(_scramble: string, expectedState: KPattern): void {
    this.expectedState = expectedState;
    this.resetPhaseTracking();
    this.setPhase("scrambling");
  }

  /**
   * Process a move from the cube.
   */
  async onMove(
    move: string,
    timestamp: number,
    stateAfterMove: KPattern,
  ): Promise<void> {
    const geometry = await this.ensureInit();

    switch (this.phase) {
      case "scrambling":
        this.handleScrambling(move, timestamp, stateAfterMove, geometry);
        break;
      case "solving_oll":
        await this.handleSolvingOLL(move, timestamp, stateAfterMove, geometry);
        break;
      case "solving_pll":
        await this.handleSolvingPLL(move, timestamp, stateAfterMove, geometry);
        break;
      // idle and done: ignore moves
    }
  }

  private handleScrambling(
    _move: string,
    timestamp: number,
    stateAfterMove: KPattern,
    _geometry: FaceGeometry,
  ): void {
    if (!this.expectedState) return;

    if (stateAfterMove.isIdentical(this.expectedState)) {
      // Scramble is done — transition to solving_oll
      // The expected state has F2L solved with an unsolved LL
      this.ollSegmentStart = timestamp;
      this.ollFirstMoveTime = null;
      this.f2lBroken = false;
      this.ollSegmentState = this.expectedState;
      this.setPhase("solving_oll");
    }
  }

  private async handleSolvingOLL(
    _move: string,
    timestamp: number,
    stateAfterMove: KPattern,
    geometry: FaceGeometry,
  ): Promise<void> {
    // Record first move time for recognition timing
    if (this.ollFirstMoveTime === null) {
      this.ollFirstMoveTime = timestamp;
    }

    const crossSolved = isCrossSolved(stateAfterMove, geometry, CROSS_FACE_IDX);
    const f2lSolved =
      crossSolved && isF2LSolved(stateAfterMove, geometry, CROSS_FACE_IDX);
    const ollSolved =
      f2lSolved && isOLLSolved(stateAfterMove, geometry, CROSS_FACE_IDX);

    if (!f2lSolved) {
      // F2L is broken — user is mid-algorithm
      this.f2lBroken = true;
      return;
    }

    // F2L is solved
    if (ollSolved) {
      // OLL is solved! Record the final OLL segment and transition to PLL.
      // Recognize the OLL case from the state at the start of this segment.
      const caseName = await this.recognizeOLLSegmentCase();
      this.ollSegments.push({
        caseName,
        recognitionTime: this.ollFirstMoveTime! - this.ollSegmentStart!,
        executionTime: timestamp - this.ollFirstMoveTime!,
      });

      // Transition to PLL phase — state now has F2L+OLL solved
      this.pllSegmentStart = timestamp;
      this.pllFirstMoveTime = null;
      this.pllStartedExecution = false;
      this.pllSegmentState = stateAfterMove;
      this.setPhase("solving_pll");
      return;
    }

    // F2L solved but OLL not solved
    if (this.f2lBroken) {
      // F2L was broken and is now restored, but OLL is still not solved.
      // This is a 2-look OLL intermediate.
      const caseName = await this.recognizeOLLSegmentCase();
      this.ollSegments.push({
        caseName,
        recognitionTime: this.ollFirstMoveTime! - this.ollSegmentStart!,
        executionTime: timestamp - this.ollFirstMoveTime!,
      });

      // Start tracking the next OLL look
      this.ollSegmentStart = timestamp;
      this.ollFirstMoveTime = null;
      this.f2lBroken = false;
      this.ollSegmentState = stateAfterMove; // new OLL case to recognize
    }
  }

  private async handleSolvingPLL(
    _move: string,
    timestamp: number,
    stateAfterMove: KPattern,
    geometry: FaceGeometry,
  ): Promise<void> {
    // Record first move time for recognition timing
    if (this.pllFirstMoveTime === null) {
      this.pllFirstMoveTime = timestamp;
    }

    const crossSolved = isCrossSolved(stateAfterMove, geometry, CROSS_FACE_IDX);
    const f2lSolved =
      crossSolved && isF2LSolved(stateAfterMove, geometry, CROSS_FACE_IDX);
    const ollSolved =
      f2lSolved && isOLLSolved(stateAfterMove, geometry, CROSS_FACE_IDX);

    if (!f2lSolved || !ollSolved) {
      // F2L or OLL is broken — user is mid-algorithm
      this.pllStartedExecution = true;
      return;
    }

    // F2L and OLL are both solved
    if (isSolved(stateAfterMove)) {
      // Cube is fully solved! Record final PLL segment.
      // Recognize PLL from the state at the start of this segment.
      const pllCase = await this.recognizePLLSegmentCase();
      this.pllSegments.push({
        caseName: pllCase,
        recognitionTime: this.pllFirstMoveTime! - this.pllSegmentStart!,
        executionTime: timestamp - this.pllFirstMoveTime!,
      });

      this.emitCompletion(timestamp);
      this.setPhase("done");
      return;
    }

    // F2L+OLL solved but not fully solved → still in PLL
    if (this.pllStartedExecution) {
      // User executed a PLL alg that restored F2L+OLL but didn't fully solve.
      // This is a 2-look PLL intermediate.
      const pllCase = await this.recognizePLLSegmentCase();
      this.pllSegments.push({
        caseName: pllCase,
        recognitionTime: this.pllFirstMoveTime! - this.pllSegmentStart!,
        executionTime: timestamp - this.pllFirstMoveTime!,
      });

      // Start tracking the next PLL look
      this.pllSegmentStart = timestamp;
      this.pllFirstMoveTime = null;
      this.pllStartedExecution = false;
      this.pllSegmentState = stateAfterMove; // new PLL case
    }
  }

  /**
   * Recognize the OLL case from the state captured at the start of the current segment.
   */
  private async recognizeOLLSegmentCase(): Promise<string> {
    if (this.ollSegmentState) {
      const name = await recognizeOLL(this.ollSegmentState, CROSS_FACE);
      if (name) return name;
    }
    return "unknown";
  }

  /**
   * Recognize the PLL case from the state captured at the start of the current segment.
   */
  private async recognizePLLSegmentCase(): Promise<string> {
    if (this.pllSegmentState) {
      const name = await recognizePLL(this.pllSegmentState, CROSS_FACE);
      if (name) return name;
    }
    return "unknown";
  }

  private emitCompletion(timestamp: number): void {
    const ollTime = this.ollSegments.reduce(
      (sum, s) => sum + s.recognitionTime + s.executionTime,
      0,
    );
    const pllTime = this.pllSegments.reduce(
      (sum, s) => sum + s.recognitionTime + s.executionTime,
      0,
    );

    const completion: LLPracticeCompletion = {
      ollSegments: [...this.ollSegments],
      pllSegments: [...this.pllSegments],
      ollTime,
      pllTime,
      totalTime: ollTime + pllTime,
      timestamp,
    };

    for (const listener of this.completionListeners) {
      listener(completion);
    }
  }

  private setPhase(phase: LLPracticePhase): void {
    this.phase = phase;
    for (const listener of this.phaseListeners) {
      listener(phase);
    }
  }

  private resetPhaseTracking(): void {
    this.ollSegmentStart = null;
    this.ollFirstMoveTime = null;
    this.ollSegments = [];
    this.f2lBroken = false;
    this.ollSegmentState = null;
    this.pllSegmentStart = null;
    this.pllFirstMoveTime = null;
    this.pllSegments = [];
    this.pllStartedExecution = false;
    this.pllSegmentState = null;
  }

  reset(): void {
    this.phase = "idle";
    this.expectedState = null;
    this.resetPhaseTracking();
  }

  addCompletionListener(listener: LLPracticeCompletionListener): void {
    this.completionListeners.add(listener);
  }

  removeCompletionListener(listener: LLPracticeCompletionListener): void {
    this.completionListeners.delete(listener);
  }

  addPhaseListener(listener: LLPracticePhaseListener): void {
    this.phaseListeners.add(listener);
  }

  removePhaseListener(listener: LLPracticePhaseListener): void {
    this.phaseListeners.delete(listener);
  }
}
