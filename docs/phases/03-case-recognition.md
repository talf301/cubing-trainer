# Phase 3: Case Recognition

## Context
With solves segmented and stored, this phase adds recognition of specific OLL/PLL cases
from cube state at the phase boundary, and labels each solve with its cases.

## Depends on
Phase 2 (Solve Recording + CFOP Segmentation)

## Goals
Identify which of the 57 OLL cases and 21 PLL cases occurred in each solve, stored
against the solve record. F2L pair recognition is a stretch goal for this phase.

## Acceptance criteria
- [ ] All 57 OLL cases are recognized correctly from cube state at OLL phase boundary
- [ ] All 21 PLL cases are recognized correctly from cube state at PLL phase boundary
- [ ] Cases are labelled with standard names (e.g. "OLL 33", "T-perm") 
- [ ] Case labels are stored on the solve record in IndexedDB
- [ ] Recognition is deterministic — same state always produces same case label
- [ ] Recognition handles AUF (adjustment of U face before/after) correctly for PLL
- [ ] Unit tests cover all 57 OLL cases and all 21 PLL cases with known cube states
- [ ] **Stretch:** F2L pair cases are recognized for each of the 4 pairs per solve

## Out of scope
- Training UI or drilling — that's Phase 4
- Cross case recognition (not standard CFOP practice)
- ZBLL or other advanced recognition

## Key technical notes
- cubing.js has pattern matching utilities — investigate whether case recognition can be
  built on top of `experimentalSolveSide` or similar, or whether it requires a lookup table
  approach from cube state. Write an ADR for the approach chosen.
- AUF handling for PLL: the cube state at the PLL boundary may have any of 4 AUF rotations.
  Recognition must normalize for this.
- F2L case recognition is significantly more complex than OLL/PLL — 41 cases per slot × 4 slots,
  plus orientation. Scope carefully and consider doing one slot first as a proof of concept.
- Build a test harness that generates known cube states for each case — this is the only
  reliable way to verify recognition coverage.

## Status
backlog
