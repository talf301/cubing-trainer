# Phase 4: Case Recognition

## Context
With solves segmented into CFOP phases, this phase adds recognition of specific OLL/PLL
cases from cube state at the phase boundary, and labels each solve with its cases.

## Depends on
Phase 3 (CFOP Segmentation)

## Goals
Identify which of the 57 OLL cases and 21 PLL cases occurred in each solve, stored
against the solve record. F2L pair recognition is a stretch goal.

## Acceptance criteria
- [x] All 57 OLL cases are recognized correctly from cube state at OLL phase boundary
- [x] All 21 PLL cases are recognized correctly from cube state at PLL phase boundary
- [x] Cases are labelled with standard names (e.g. "OLL 33", "T-perm")
- [x] Case labels are stored on the solve record in IndexedDB
- [x] Recognition is deterministic — same state always produces same case label
- [x] Recognition handles AUF (adjustment of U face before/after) correctly for PLL
- [x] Case recognition runs retroactively on existing stored solves
- [x] Unit tests cover all 57 OLL cases and all 21 PLL cases with known cube states
- [ ] **Stretch:** F2L pair cases are recognized for each of the 4 pairs per solve (deferred)

## Out of scope
- Training UI or drilling — that's Phase 5
- Cross case recognition (not standard CFOP practice)
- ZBLL or other advanced recognition

## Key technical notes
- Investigate cubing.js pattern matching utilities for case recognition before building
  a lookup table approach. Write an ADR for the approach chosen.
- AUF handling for PLL: the cube state at the PLL boundary may have any of 4 AUF
  rotations. Recognition must normalize for this.
- F2L case recognition is significantly more complex than OLL/PLL — 41 cases per
  slot × 4 slots, plus orientation. Scope carefully and consider doing one slot first
  as a proof of concept.
- Build a test harness that generates known cube states for each case — this is the
  only reliable way to verify recognition coverage.
- Case recognition is a pure function: cube state in, case label out.
  Lives in `core/`, no UI or persistence dependency.

## Status
complete

<!-- 2026-03-20: All acceptance criteria met. 57 OLL + 21 PLL fingerprints generated from standard algorithms, verified by tests (apply alg to fingerprint state → assert solved). Recognizer functions with AUF normalization via face moves. Integrated into segmentSolve, backfill for existing solves, case names displayed in solve history UI. ADR-002 documents approach. F2L recognition deferred. -->
