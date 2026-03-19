# Phase 4: Spaced Repetition + Training UI

## Context
Final phase. With case recognition in place, this phase builds the spaced repetition
scheduler and the training UI for targeted case drilling.

## Depends on
Phase 3 (Case Recognition)

## Goals
Surface weak OLL/PLL cases based on solve history using spaced repetition, and provide
a drill mode for targeted practice on specific cases or surfaced weak sets.

## Acceptance criteria
- [ ] Spaced repetition scheduler ingests solve history and produces a prioritized list
      of cases to review, weighted by recency and success rate
- [ ] "Train weak cases" mode presents cases the scheduler has surfaced
- [ ] Drill mode lets you practice a specific case: shows the case state, you solve it,
      result is recorded and fed back to the scheduler
- [ ] Case analytics view shows per-case solve count, average recognition time, trend
- [ ] Scheduler state persists in IndexedDB and updates incrementally as solves come in
- [ ] UI works correctly on iOS (Capacitor) and desktop Chrome

## Out of scope
- Scheduling across methods (non-CFOP)
- Algorithm recommendation (which alg to learn) — out of scope for v1
- Notifications or reminders

## Key technical notes
- Spaced repetition algorithm: SM-2 is the standard starting point and well understood.
  Write an ADR before choosing an alternative. The scheduler must be pure TS with no
  UI dependency — it's a core logic module.
- "Recognition time" for a case in drill mode: time from when the case is presented
  to when the first move is made. This is distinct from execution time.
- The scheduler should be designed to work on OLL/PLL initially, with F2L cases as
  a drop-in addition if Phase 3's stretch goal was completed.

## Status
backlog
