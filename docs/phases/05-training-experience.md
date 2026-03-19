# Phase 5: Training Experience

## Context
With case recognition and CFOP segmentation complete, this phase builds the training
experience — how the app helps the user improve at weak cases.

## Depends on
Phase 4 (Case Recognition)

## Goals
Provide a structured training experience that helps users improve at their weakest
OLL/PLL cases. The specific approach and UX will be designed when this phase is active.

## Acceptance criteria
TBD — to be defined when this phase is scoped. The broad goals are:
- [ ] The app identifies which cases the user is weakest at
- [ ] A training mode helps the user practice those cases
- [ ] Progress is tracked and visible
- [ ] The experience works on desktop Chrome

## Out of scope
- Scheduling across methods (non-CFOP)
- Notifications or reminders

## Key technical notes
- The training logic (whatever form it takes) must be pure TS in `core/` —
  framework-agnostic per the project invariants.
- "Recognition time" (time from case presented to first move) is a distinct and
  valuable metric, separate from execution time.
- Design should accommodate F2L cases as a future addition if Phase 4's stretch
  goal was completed.

## Open questions
- What training approach works best? Standard spaced repetition (SM-2), or something
  different? The user has ideas here that should drive the design.
- How should drill mode work — app-generated scrambles that produce specific cases?
  Or something else?
- What analytics/visualization helps a cuber most?

## Status
backlog
