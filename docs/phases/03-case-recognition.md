# Phase 3: CFOP Segmentation

## Context
With solves being recorded with full move sequences and timestamps, this phase adds
the ability to retroactively segment a solve into its CFOP phases with per-phase timing.

## Depends on
Phase 2 (Scrambles + Solve Detection)

## Goals
Replay a recorded solve's move sequence against KPuzzle state and detect when each
CFOP phase boundary is crossed. Store per-phase split times on the solve record.

## Acceptance criteria
- [x] Cross completion is detected: bottom-layer cross is solved (any cross color)
- [x] F2L completion is detected: all four F2L pairs are solved
- [x] OLL completion is detected: top face is a single color
- [x] PLL completion is detected: cube is fully solved (already handled by solve detection)
- [x] Phase boundaries are detected by replaying the move sequence against KPuzzle state
- [x] Per-phase split times are calculated from move timestamps at boundaries
- [x] Segmentation runs retroactively on existing stored solves
- [x] Solve history view shows per-phase split times
- [x] Cross color is auto-detected (not assumed to be white)
- [x] Unit tests cover phase boundary detection for each transition

## Out of scope
- X-cross detection (cross + one F2L pair simultaneously)
- Case recognition (which OLL/PLL case) — that's Phase 4
- Non-CFOP methods
- Real-time segmentation during the solve (retroactive replay is sufficient)

## Key technical notes
- Cross color detection: after the solve, check which face's cross was solved first.
  The user may use any cross color, and it may vary between solves.
- Phase boundary detection is state-based: at each move, check if the relevant pieces
  are in their solved positions. This uses KPuzzle state inspection, not move counting.
- F2L detection: check each of the 4 corner-edge pairs in the first two layers.
  F2L is complete when all 4 pairs are solved (regardless of insertion order).
- Edge case: some solvers partially complete later phases while still in an earlier one
  (e.g., influencing OLL during F2L). The boundary should be defined as the first moment
  the phase's condition is met and remains met through the rest of the solve.
- Segmentation is a pure function: move sequence + timestamps in, phase boundaries out.
  No UI or persistence dependency — lives in `core/`.

## Status
complete

<!-- 2026-03-20: All acceptance criteria met. segmentSolve replays moves against KPuzzle, detects cross/F2L/OLL/PLL boundaries, auto-detects cross color across all 6 faces. 20 unit tests passing. Split times displayed in solve history. Backfill runs on mount for existing solves. -->
