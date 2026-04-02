import type { KPattern, KPuzzle } from "cubing/kpuzzle";
import { cube3x3x3 } from "cubing/puzzles";
import {
  buildFaceGeometry,
  isCrossSolved,
  isF2LSolved,
  isOLLSolved,
  type FaceGeometry,
} from "./cfop-segmenter";
import { PLL_CASES } from "./pll-cases";

/** Minimum number of moves to consider a PLL completion (filters AUF) */
const MIN_MOVES = 4;

/** Cross face is always D for PLL spam */
const CROSS_FACE_IDX = 5;

export interface PllSpamCompletion {
  caseName: string;
  time: number; // ms between first move after previous completion and the completing move
  moveCount: number;
  timestamp: number; // absolute timestamp of the completing move
}

export type PllSpamCompletionListener = (completion: PllSpamCompletion) => void;

/** Debug info emitted on every move for diagnostic display */
export interface PllSpamDebugInfo {
  move: string;
  crossSolved: boolean;
  f2lSolved: boolean;
  ollSolved: boolean;
  hasBaseline: boolean;
  movesSinceBaseline: number;
  /** Set when detection triggers but delta doesn't match any case */
  unmatchedDelta: { corners: number[]; edges: number[] } | null;
  /** Last recognized case (from successful detection) */
  lastResult: string | null;
}

export type PllSpamDebugListener = (info: PllSpamDebugInfo) => void;

// Cached kpuzzle assets (same for every session)
let cachedKpuzzle: KPuzzle | null = null;
let cachedGeometry: FaceGeometry | null = null;
let cachedEdgePositions: number[] | null = null;
let cachedCornerPositions: number[] | null = null;
let cachedHomeEdges: Map<number, number> | null = null;
let cachedHomeCorners: Map<number, number> | null = null;

// For D cross, LL face = U (opposite of D). OLL face index = 0 (U).
// ROTATION_TO_U[0] = "" — no rotation needed since LL is already on U.
// We read U-face positions directly from geometry.faceEdges[0] / faceCorners[0].
const OPPOSITE_FACE = [5, 3, 4, 1, 2, 0] as const;
const LL_FACE_IDX = OPPOSITE_FACE[CROSS_FACE_IDX]; // 0 = U face

async function getAssets(): Promise<{
  kpuzzle: KPuzzle;
  geometry: FaceGeometry;
  edgePositions: number[];
  cornerPositions: number[];
  homeEdges: Map<number, number>;
  homeCorners: Map<number, number>;
}> {
  if (!cachedKpuzzle) {
    cachedKpuzzle = await cube3x3x3.kpuzzle();
  }
  if (!cachedGeometry) {
    cachedGeometry = buildFaceGeometry(cachedKpuzzle);
  }
  if (!cachedEdgePositions) {
    // LL face positions (U face for D cross — no alignment rotation needed)
    cachedEdgePositions = cachedGeometry.faceEdges[LL_FACE_IDX];
    cachedCornerPositions = cachedGeometry.faceCorners[LL_FACE_IDX];

    // Home piece mapping: in the solved state, which piece is at each LL position?
    // Maps piece index → normalized 0-3 index
    const solvedState = cachedKpuzzle.defaultPattern();
    cachedHomeEdges = new Map();
    cachedEdgePositions.forEach((pos, i) => {
      cachedHomeEdges!.set(
        solvedState.patternData["EDGES"].pieces[pos],
        i,
      );
    });
    cachedHomeCorners = new Map();
    cachedCornerPositions.forEach((pos, i) => {
      cachedHomeCorners!.set(
        solvedState.patternData["CORNERS"].pieces[pos],
        i,
      );
    });
  }
  return {
    kpuzzle: cachedKpuzzle,
    geometry: cachedGeometry,
    edgePositions: cachedEdgePositions,
    cornerPositions: cachedCornerPositions!,
    homeEdges: cachedHomeEdges!,
    homeCorners: cachedHomeCorners!,
  };
}

interface DeltaPLLResult {
  caseName: string | null;
  /** The delta permutation from the first AUF attempt (for debugging) */
  delta: { corners: number[]; edges: number[] } | null;
}

/**
 * Identify the PLL case by computing the permutation delta between
 * baseline and current states. Both states must have F2L+OLL solved.
 *
 * The delta represents the PLL algorithm the user executed:
 * delta = current_arrangement^(-1) ∘ baseline_arrangement
 *
 * Returns the PLL case name, or null if the delta doesn't match any case.
 */
async function recognizeDeltaPLL(
  baseline: KPattern,
  current: KPattern,
): Promise<DeltaPLLResult> {
  const { edgePositions, cornerPositions, homeEdges, homeCorners } =
    await getAssets();

  // For D cross, LL = U face. No alignment rotation needed.
  // Read LL piece positions directly from the states.

  // Get normalized baseline arrangement
  const baseEdgeNorm = edgePositions.map(
    (p) => homeEdges.get(baseline.patternData["EDGES"].pieces[p])!,
  );
  const baseCornerNorm = cornerPositions.map(
    (p) => homeCorners.get(baseline.patternData["CORNERS"].pieces[p])!,
  );

  // Try 4 AUF rotations on current (post-AUF) × 4 rotations on baseline
  // (conjugation). Conjugation is needed because cube rotations (x/y/z)
  // during algorithms cause GAN state tracking to shift the U-layer frame.
  // A PLL executed after an undetected rotation appears as the same case
  // but conjugated by U — e.g., Aa cycle (0,2,1) becomes (1,3,2).
  const rotations = ["", "U", "U2", "U'"];
  let firstDelta: { corners: number[]; edges: number[] } | null = null;

  for (const baseRot of rotations) {
    const rotBase = baseRot ? baseline.applyAlg(baseRot) : baseline;
    const rotBaseEdgeNorm = baseRot
      ? edgePositions.map(
          (p) => homeEdges.get(rotBase.patternData["EDGES"].pieces[p])!,
        )
      : baseEdgeNorm;
    const rotBaseCornerNorm = baseRot
      ? cornerPositions.map(
          (p) => homeCorners.get(rotBase.patternData["CORNERS"].pieces[p])!,
        )
      : baseCornerNorm;

    for (const currRot of rotations) {
      const rotCurr = currRot ? current.applyAlg(currRot) : current;

      const currEdgeNorm = edgePositions.map(
        (p) => homeEdges.get(rotCurr.patternData["EDGES"].pieces[p])!,
      );
      const currCornerNorm = cornerPositions.map(
        (p) => homeCorners.get(rotCurr.patternData["CORNERS"].pieces[p])!,
      );

      // Build inverse of current arrangement: currInv[piece] = position
      const currEdgeInv: number[] = Array(4);
      currEdgeNorm.forEach((piece, pos) => {
        currEdgeInv[piece] = pos;
      });
      const currCornerInv: number[] = Array(4);
      currCornerNorm.forEach((piece, pos) => {
        currCornerInv[piece] = pos;
      });

      // Delta permutation: delta[i] = currInv[base[i]]
      const deltaEdges = rotBaseEdgeNorm.map((piece) => currEdgeInv[piece]);
      const deltaCorners = rotBaseCornerNorm.map(
        (piece) => currCornerInv[piece],
      );

      if (!firstDelta) {
        firstDelta = { corners: deltaCorners, edges: deltaEdges };
      }

      // Match against PLL cases
      for (const [name, caseData] of Object.entries(PLL_CASES)) {
        if (
          deltaEdges.every((v, i) => v === caseData.edges[i]) &&
          deltaCorners.every((v, i) => v === caseData.corners[i])
        ) {
          return { caseName: name, delta: null };
        }
      }
    }
  }

  return { caseName: null, delta: firstDelta };
}

/**
 * PllSpamSession tracks cube moves and detects completed PLL algorithms.
 *
 * It maintains a "baseline" state — the last state where F2L is solved and
 * the last layer is oriented (OLL complete). When the cube returns to that
 * condition after 4+ moves, it identifies the PLL case via permutation delta
 * between baseline and current, and emits a completion event.
 *
 * Designed for rapid-fire PLL practice: the user just keeps executing PLLs
 * back-to-back on a solved (or F2L+OLL-solved) cube.
 */
export class PllSpamSession {
  private baseline: KPattern | null = null;
  private movesSinceBaseline: number = 0;
  private timingStart: number | null = null;
  private geometry: FaceGeometry | null = null;
  private completionListeners = new Set<PllSpamCompletionListener>();
  private debugListeners = new Set<PllSpamDebugListener>();
  private initialized = false;
  private lastResult: string | null = null;

  /**
   * Ensure kpuzzle assets are loaded. Called lazily on first move.
   */
  private async ensureInit(): Promise<FaceGeometry> {
    if (!this.initialized) {
      const { geometry } = await getAssets();
      this.geometry = geometry;
      this.initialized = true;
    }
    return this.geometry!;
  }

  /**
   * Process a move from the cube.
   * @param _move - The move string (e.g., "R", "U'")
   * @param timestamp - Absolute timestamp of the move
   * @param stateAfterMove - The full cube state after the move was applied
   */
  async onMove(
    _move: string,
    timestamp: number,
    stateAfterMove: KPattern,
  ): Promise<void> {
    const geometry = await this.ensureInit();

    // Check if cross + F2L is solved and OLL is complete (the detection condition).
    // Cross check is needed because M2 moves (used in H/Z/U perms) swap cross
    // edges with LL edges without breaking F2L corners/equator or OLL orientation.
    const crossSolved = isCrossSolved(stateAfterMove, geometry, CROSS_FACE_IDX);
    const f2lSolved =
      crossSolved && isF2LSolved(stateAfterMove, geometry, CROSS_FACE_IDX);
    const ollSolved =
      f2lSolved && isOLLSolved(stateAfterMove, geometry, CROSS_FACE_IDX);

    if (!ollSolved) {
      // Not in detection state — just count moves if we have a baseline
      if (this.baseline !== null) {
        this.movesSinceBaseline++;
        // Start timing on first move after a completion/baseline set
        if (this.timingStart === null) {
          this.timingStart = timestamp;
        }
      }
      this.emitDebug({
        move: _move,
        crossSolved,
        f2lSolved,
        ollSolved,
        hasBaseline: this.baseline !== null,
        movesSinceBaseline: this.movesSinceBaseline,
        unmatchedDelta: null,
        lastResult: this.lastResult,
      });
      return;
    }

    // Detection condition met: F2L solved + OLL solved
    if (this.baseline === null) {
      // No baseline yet — set one and wait for actual PLL execution
      this.baseline = stateAfterMove;
      this.movesSinceBaseline = 0;
      this.timingStart = null;
      this.emitDebug({
        move: _move,
        crossSolved,
        f2lSolved,
        ollSolved,
        hasBaseline: true,
        movesSinceBaseline: 0,
        unmatchedDelta: null,
        lastResult: this.lastResult,
      });
      return;
    }

    // We have a baseline and condition is met again
    this.movesSinceBaseline++;

    if (this.movesSinceBaseline < MIN_MOVES) {
      // Too few moves — this is likely just AUF. Update baseline.
      this.baseline = stateAfterMove;
      this.movesSinceBaseline = 0;
      this.timingStart = null;
      this.emitDebug({
        move: _move,
        crossSolved,
        f2lSolved,
        ollSolved,
        hasBaseline: true,
        movesSinceBaseline: 0,
        unmatchedDelta: null,
        lastResult: this.lastResult,
      });
      return;
    }

    // 4+ moves and condition met — identify PLL via permutation delta
    const { caseName, delta } = await recognizeDeltaPLL(this.baseline, stateAfterMove);
    if (caseName === null) {
      // Unrecognized permutation delta — discard and update baseline
      this.lastResult = null;
      this.emitDebug({
        move: _move,
        crossSolved,
        f2lSolved,
        ollSolved,
        hasBaseline: true,
        movesSinceBaseline: this.movesSinceBaseline,
        unmatchedDelta: delta,
        lastResult: null,
      });
      this.baseline = stateAfterMove;
      this.movesSinceBaseline = 0;
      this.timingStart = null;
      return;
    }

    // Valid PLL completion!
    const time =
      this.timingStart !== null ? timestamp - this.timingStart : 0;

    const completion: PllSpamCompletion = {
      caseName,
      time,
      moveCount: this.movesSinceBaseline,
      timestamp,
    };

    // Update baseline for next PLL
    this.lastResult = caseName;
    this.baseline = stateAfterMove;
    this.movesSinceBaseline = 0;
    this.timingStart = null;

    this.emitDebug({
      move: _move,
      crossSolved,
      f2lSolved,
      ollSolved,
      hasBaseline: true,
      movesSinceBaseline: 0,
      unmatchedDelta: null,
      lastResult: caseName,
    });

    // Emit completion event
    for (const listener of this.completionListeners) {
      listener(completion);
    }
  }

  /**
   * Reset the session (e.g., on disconnect). Clears baseline and all tracking state.
   */
  reset(): void {
    this.baseline = null;
    this.movesSinceBaseline = 0;
    this.timingStart = null;
  }

  addCompletionListener(listener: PllSpamCompletionListener): void {
    this.completionListeners.add(listener);
  }

  removeCompletionListener(listener: PllSpamCompletionListener): void {
    this.completionListeners.delete(listener);
  }

  addDebugListener(listener: PllSpamDebugListener): void {
    this.debugListeners.add(listener);
  }

  removeDebugListener(listener: PllSpamDebugListener): void {
    this.debugListeners.delete(listener);
  }

  private emitDebug(info: PllSpamDebugInfo): void {
    for (const listener of this.debugListeners) {
      listener(info);
    }
  }
}
