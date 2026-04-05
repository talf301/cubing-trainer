---
gp-node: last-layer-practice
---

# Last Layer Practice — Design Spec

**Date:** 2026-04-04
**Type:** Feature
**Parent:** training-experience epic

## Goal

A trainer for practicing full last layer solves on a physical smart cube. The app generates a scramble that produces a random LL state (F2L pre-solved), the user physically applies it, then solves OLL and PLL while being timed. The app detects OLL/PLL completion, identifies the cases, distinguishes 1-look vs 2-look solves, and breaks down recognition vs execution time for each phase.

## Scramble Generation

### Approach

Generate a random LL state using the `cubing/search` solver:

1. Pick a random OLL case (uniform from 57) and a random PLL case (uniform from 21). Add a random AUF (U, U2, U', or none).
2. Construct the target `KPattern` by applying `inverse(PLL alg) → inverse(OLL alg) → AUF` to a solved cube. This produces a state with F2L solved and the desired LL state.
3. Use `experimentalSolve3x3x3IgnoringCenters` to find an optimal solution for that state.
4. The **inverse** of that solution is the scramble — ~14-18 moves, non-recognizable, uses full move set.

The solver has a ~750ms cold start (worker initialization) but subsequent solves are 1-5ms. Warm up the solver on page load so the first scramble is ready instantly.

### Module

`generateLLScramble()` in `src/core/ll-scramble.ts`:

```typescript
interface LLScrambleResult {
  scramble: string;           // Move sequence to apply to solved cube
  expectedState: KPattern;    // Cube state after scramble is applied
}

async function generateLLScramble(): Promise<LLScrambleResult>
async function warmupSolver(): Promise<void>
```

Reuses existing `OLL_CASES` and `PLL_CASES` for case definitions.

## Detection Engine — `LLPracticeSession`

New session class in `src/core/ll-practice-session.ts`, following the established session pattern (`PllSpamSession`, `F2LSolutionSession`).

### State Machine

```
idle → scrambling → solving_oll → solving_pll → done → scrambling → ...
```

- **`idle`**: Waiting for start. Transitions to `scrambling` when `start(scramble, expectedState)` is called.
- **`scrambling`**: User applying the LL scramble. Uses `ScrambleTracker` internally. Transitions to `solving_oll` when cube state matches the expected scrambled state.
- **`solving_oll`**: Timer starts on first move. On each move, check `isCrossSolved + isF2LSolved` (F2L must remain solved) and `isOLLSolved`. If F2L is solved and OLL is solved → transition to `solving_pll`. If F2L returns to solved with a different OLL case still present → 2-look intermediate (increment look count, record the intermediate case and its recognition/execution times via `recognizeOLL`). Recognize the final OLL case using `recognizeOLL`.
- **`solving_pll`**: Same approach. On each move, check if cube is fully solved (F2L + OLL + PLL all done). If F2L+OLL stay solved but a different PLL permutation appears → 2-look intermediate. Recognize PLL case(s) using `recognizePLL`. Transitions to `done` when solved.
- **`done`**: Emits a completion event with all timing/case data. The hook auto-starts the next scramble.

### Recognition vs Execution Timing

- **Recognition time** = time from phase start (or previous execution end) to first move in that sub-phase.
- **Execution time** = time from first move to phase completion (or next intermediate state for 2-look).
- For 2-look: each look gets its own `LLPhaseSegment` with independent recognition + execution times.

### 2-Look Detection

During OLL: after the user breaks F2L (by starting their OLL algorithm), if the cube returns to a state where F2L is solved but OLL is *not* solved (LL orientation differs from both the starting state and the solved state), that's a 2-look intermediate. The first OLL algorithm restored F2L but left a different OLL case. The recognition timer for the second look starts from this point.

During PLL: after OLL is solved, if the cube returns to a state where F2L and OLL are both solved but the cube is *not* fully solved (LL permutation differs from both the starting PLL state and the identity), that's a 2-look intermediate. The first PLL algorithm left a different PLL case.

### Reused Code

- `isCrossSolved`, `isF2LSolved`, `isOLLSolved` from `cfop-segmenter.ts`
- `recognizeOLL`, `recognizePLL` from `case-recognizer.ts`
- `ScrambleTracker` from `scramble-tracker.ts` for scramble walkthrough
- Listener/event pattern from `PllSpamSession`

## Data Model

### Completion Event

```typescript
interface LLPhaseSegment {
  caseName: string;           // e.g., "OLL 21" or "T"
  recognitionTime: number;    // ms before first move in this segment
  executionTime: number;      // ms from first move to segment end
}

interface LLPracticeCompletion {
  ollSegments: LLPhaseSegment[];  // 1 entry for 1-look, 2 for 2-look
  pllSegments: LLPhaseSegment[];  // same
  ollTime: number;                // total OLL ms
  pllTime: number;                // total PLL ms
  totalTime: number;              // total LL ms
  timestamp: number;
}
```

### IndexedDB Schema

New object store `llPracticeAttempts` added in a v6 migration in `src/lib/db.ts`:

```typescript
interface LLPracticeAttempt {
  id: string;                     // UUID
  ollSegments: LLPhaseSegment[];
  pllSegments: LLPhaseSegment[];
  ollTime: number;
  pllTime: number;
  totalTime: number;
  timestamp: number;              // Date.now()
}
```

Index: `by-timestamp` (timestamp).

Data volume is small (hundreds of attempts), so per-case queries are done by loading all attempts and filtering in memory rather than adding case-name indexes on nested segments.

### Store Class

`LLPracticeStore` in `src/lib/ll-practice-store.ts`:
- `addAttempt(attempt: LLPracticeAttempt): Promise<void>`
- `getAllAttempts(): Promise<LLPracticeAttempt[]>`

## UI — Timer Page

`LLPracticePage` at `/training/ll`.

### Layout

Follows the same structure as `SolvePage`:

- **Scramble phase**: `ScrambleDisplay` component (reused directly) showing the LL scramble with move-by-move tracking. Previous solve's time bar persists above the scramble during this phase.
- **Solving phase**: Large monospace timer display, updated every 10ms. Status text indicates current phase ("OLL" / "PLL").
- **Done phase**: Timer freezes, segmented time bar appears showing full breakdown. Auto-advances to next scramble immediately.

### Segmented Time Bar

Each solve displayed as a horizontal bar with proportionally-sized segments:

- **Blue** (`#5b8af5`) = OLL execution, **dull blue** (`#3b5998`) = OLL recognition
- **Orange** (`#e8922f`) = PLL execution, **dull brown** (`#7a4a1a`) = PLL recognition
- Case names shown inline in execution segments (e.g., "OLL 21", "T perm")
- For 2-look: recognition → execution → recognition → execution within the same color family
- Phase totals shown below the bar

### Recent Attempts Log

Scrolling list below the timer — each entry is a segmented time bar. Newest at top, capped at ~25 entries. Ephemeral (current page visit only); all attempts persisted to IndexedDB regardless.

### Component

`LLTimeBar` in `src/features/ll-trainer/LLTimeBar.tsx` — takes an `LLPracticeCompletion` and renders the segmented bar. Used for both the "last solve" display (larger) and recent attempts log entries (compact).

### React Hook

`useLLPractice(connection)` in `src/features/ll-trainer/use-ll-practice.ts`:
- Creates and manages `LLPracticeSession` via `useRef`
- Warms up solver on mount, generates scrambles
- Subscribes to cube moves from the shared connection
- Persists completions to `LLPracticeStore`
- Exposes: current phase, scramble tracker state, timer display value, last completion, recent completions list

## UI — Stats Page

`LLStatsPage` at `/training/ll/stats`.

### Summary Cards

Top row:
- Total attempts
- Average LL time
- Average OLL time / Average PLL time
- 1-look OLL rate (% of solves where OLL was 1 segment)
- 1-look PLL rate (% of solves where PLL was 1 segment)

### Per-Case Tables

Two tables — one for OLL cases, one for PLL cases. Each row:
- Case name
- Attempt count
- Average time (recognition + execution combined)
- Average recognition time
- Average execution time
- 1-look rate

Sorted by slowest average time (weakest cases at top). Cases with no attempts shown at bottom, grayed out.

Reuses `topPercentMetric` and `sparklineData` from `pll-spam-stats.ts` where applicable.

## File Structure

```
src/
  core/
    ll-practice-session.ts          # Detection engine / state machine
    ll-scramble.ts                  # LL scramble generation (solver-based)
    __tests__/
      ll-practice-session.test.ts
      ll-scramble.test.ts
  lib/
    ll-practice-store.ts            # IndexedDB persistence
    db.ts                           # v6 migration (modified)
  features/
    ll-trainer/
      LLPracticePage.tsx            # Timer page
      LLTimeBar.tsx                 # Segmented color bar component
      LLStatsPage.tsx               # Stats page
      use-ll-practice.ts            # React hook
  app/
    routes.tsx                      # New routes (modified)
  features/
    training/
      TrainingPage.tsx              # Add LL trainer to menu (modified)
```

## Routes

- `/training/ll` → `LLPracticePage`
- `/training/ll/stats` → `LLStatsPage`

Added to Training menu on `TrainingPage`.

## Dependencies (all existing)

- `cfop-segmenter.ts` — `isCrossSolved`, `isF2LSolved`, `isOLLSolved`
- `case-recognizer.ts` — `recognizeOLL`, `recognizePLL`
- `scramble-tracker.ts` + `ScrambleDisplay.tsx` — scramble walkthrough
- `pll-spam-stats.ts` — `topPercentMetric`, `sparklineData`
- `cubing/search` — `experimentalSolve3x3x3IgnoringCenters` for scramble generation
- `OLL_CASES`, `PLL_CASES` — case definitions for target state construction

## Out of Scope

- Weakness-based case selection (pure random for now)
- Sound or haptic feedback
- Per-case detail view (tap a case to see all attempts)
- OLL-only or PLL-only sub-modes
- Session grouping or session-level analytics
- Physical cube scramble verification beyond state matching
