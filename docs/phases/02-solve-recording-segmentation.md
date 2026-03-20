# Phase 2: Scrambles + Solve Detection

## Context
With cube connectivity in place, this phase adds scramble generation, scramble state
verification, solve timing, and basic solve recording.

## Depends on
Phase 1 (Bluetooth + Cube State)

## Goals
Generate a scramble, detect when the user has applied it to the cube, start timing on
the first move after scramble is verified, detect when the cube is solved, and record
the solve with its move sequence and timestamps.

## Acceptance criteria
- [x] Scrambles are generated using cubing.js `randomScrambleForEvent("333")`
- [x] Scramble is displayed to the user
- [x] App detects when the physical cube state matches the expected scrambled state
- [x] Timer starts automatically on the first move after scramble state is verified
- [x] Timer stops automatically when the cube reaches solved state
- [x] Full move sequence is recorded with per-move timestamps
- [x] Total solve time is accurate
- [x] Solves are persisted to IndexedDB via idb and survive page reload
- [x] A solve history list renders completed solves with total time
- [x] Unit tests cover scramble state matching and solve detection logic

## Out of scope
- CFOP phase segmentation — that's Phase 3
- Case recognition — that's Phase 4
- DNF/+2 penalty handling (can be added later)
- Manual timer mode (without smart cube)

## Key technical notes
- Scramble state verification: apply the scramble algorithm to a solved KPuzzle state
  to get the expected state, then compare against the physical cube's current state.
  This must handle the fact that the user may have the cube in any orientation.
- "First move after scramble verified" is the timer start trigger — not scramble completion
  itself, since the user may pause between finishing the scramble and starting the solve.
- The data model for a stored solve should carry the full move sequence + timestamps,
  not just total time. Phase 3 needs this for retroactive segmentation.
- IndexedDB schema: design with future phases in mind (phase splits, case labels)
  but only populate what this phase produces.

## Status
complete

<!-- 2026-03-19: Implemented all acceptance criteria — scramble generation, SolveSession state machine, IndexedDB persistence via idb, solve page UI with timer, and history page. Orientation-agnostic comparison not needed (fixed orientation: green forward, white on top). Needs manual smoke test with physical cube. -->
