# Phase 2: Solve Recording + CFOP Segmentation

## Context
With reliable cube state in place, this phase adds solve detection and the ability to
segment a completed solve into its CFOP phases with per-phase timing.

## Depends on
Phase 1 (Bluetooth + Cube State)

## Goals
Detect solve start and end automatically, record the full move sequence with timestamps,
and segment the solve into Cross / F2L / OLL / PLL phases. Store solves locally.

## Acceptance criteria
- [ ] Solve start is detected automatically (cube is in scrambled state, first move made)
- [ ] Solve end is detected automatically (cube reaches solved state)
- [ ] Full move sequence is recorded with per-move timestamps
- [ ] Total solve time is accurate (comparable to a stackmat timer)
- [ ] Solve is segmented into Cross / F2L / OLL / PLL with per-phase split times
- [ ] Phase boundaries are detected correctly: Cross done = bottom layer cross solved;
      F2L done = first two layers solved; OLL done = top face solved; PLL done = cube solved
- [ ] Solves are persisted to IndexedDB and survive page reload
- [ ] A solve history list renders completed solves with total time and phase splits
- [ ] Unit tests cover phase boundary detection logic

## Out of scope
- Case recognition (OLL/PLL/F2L cases) — that's Phase 3
- Spaced repetition or training UI — that's Phase 4
- Scramble generation or scramble validation
- DNF/+2 penalty handling (can be added later)

## Key technical notes
- Phase boundary detection is purely state-based via cubing.js — check against known
  solved patterns for cross, F2L pairs, OLL, full solve. Not move-count based.
- The data model for a stored solve should be designed with Phase 3 in mind:
  it needs to carry enough information for case recognition to be run later or retroactively.
  Store the full move sequence + timestamps, not just split times.
- IndexedDB wrapper: keep it thin. Avoid pulling in Dexie or a full ORM unless the
  schema gets complex enough to justify it — write an ADR if you add a dependency here.

## Status
backlog
