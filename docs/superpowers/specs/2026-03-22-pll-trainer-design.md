# PLL Trainer — Design Spec

## Overview

A dedicated PLL training tool with two modes: **drill** (timed recognition + execution practice with smart case selection) and **learn** (guided algorithm memorization with move-by-move feedback). Users maintain a "known PLLs" list that drives drill case selection and 2-look detection.

## Motivation

PLL is the final step of every CFOP solve. Recognizing and executing all 21 cases from muscle memory is essential for fast solves. This tool targets three gaps:

1. **Learning new algorithms** — guided practice with move-by-move checking and a 5-rep test to confirm memorization before marking a case as "known."
2. **Drilling known cases** — timed execution with smart selection that biases toward weak cases, building speed and consistency.
3. **Catching 2-look habits** — detecting when the user solves a known PLL in two steps instead of one, surfacing the habit so they can correct it.

## Architecture

### Layers

```
Routes (/training/pll)
  └─ PllTrainer.tsx              — UI: tabs, timer, review, learn panels
       └─ usePllTrainer hook     — orchestrates session, connection, scramble
            ├─ PllDrillSession        — drill state machine (core, no React)
            ├─ PllLearnSession        — learn state machine (core, no React)
            ├─ PllStatsStore          — IndexedDB persistence for PLL stats
            ├─ PllCaseSelector        — weighted random selection from history
            ├─ ScrambleTracker        — reuse existing scramble tracker
            ├─ case-recognizer        — reuse existing recognizePLL()
            └─ CubeConnection         — reuse existing bluetooth abstraction
```

The core pieces (`PllDrillSession`, `PllLearnSession`, `PllCaseSelector`, `PllStatsStore`) are all framework-agnostic TypeScript — no React dependency, testable in isolation per the project invariants.

### Drill mode state machine

```
idle → selecting → scrambling → ready → solving → review
                                                     │
                                                     └─ (next) → selecting
```

- **idle** — waiting to start
- **selecting** — `PllCaseSelector` picks a case via weighted random selection
- **scrambling** — scramble generated via cubing.js solver (see Scramble Generation), user applies it to the physical cube
- **ready** — cube state matches expected scramble, timer armed
- **solving** — first move detected, timer running, moves recorded. Each move is checked for: (1) intermediate solved-corners-but-not-edges or solved-edges-but-not-corners state → flag as 2-look if case is known, (2) fully solved PLL → transition to review
- **review** — timer stopped, case revealed, stats shown (time, move count, avg, best), 2-look warning if applicable, reference algorithm displayed. Attempt persisted to IndexedDB. "Next Scramble" button loops back to selecting.

Phase transitions emit events via a listener pattern so the React layer can react without polling (same pattern as `CrossTrainerSession`).

### Learn mode state machine

```
idle → practicing ←→ (repeat)
           │
           ▼  "Ready to test"
       testing (0/5) → ... → testing (5/5) → passed
                                                │
                                                └─ "Add to known list?"
```

- **idle** — user picks a PLL case from the list of cases not yet in their known list
- **practicing** — algorithm displayed on screen with current-move highlighting. Each cube move is checked against the expected sequence:
  - Correct move → advance highlight to next move
  - Wrong move → flag it, show the undo move, wait for user to execute the undo before continuing (strict mode)
  - All moves completed → increment rep counter, reset position in algorithm, user continues immediately (no scrambles between reps — this is purely about muscle memory)
- **testing** — algorithm hidden. Same move-checking logic. Correct completion of the full algorithm increments the pass counter. Wrong moves are acceptable as long as the user self-corrects (undo and do the right move). 5 successful completions → passed.
- **passed** — congratulations, prompt "Add to known list?"

No scrambles are involved in learn mode. The user simply executes the algorithm on the cube repeatedly. The cube will end up in various states but learn mode only cares about the move sequence matching, not the cube state.

**Rotation handling:** Some PLL algorithms contain whole-cube rotations (`x`, `y`, `z`). Smart cubes report face turns but not rotations. Learn mode skips rotation moves in the expected sequence and only validates face turns, trusting the user to adjust their grip correctly. Where possible, `PLL_CASES` should use rotation-free algorithm variants.

### Scramble generation for drill mode

Drill mode needs scrambles that leave the cube with only a specific PLL case remaining (cross, F2L, and OLL all solved).

**Approach:** Take the inverse of the target PLL algorithm, with a random AUF (U, U', U2, or nothing) prepended and appended. This produces the correct PLL state without revealing which case it is through the scramble notation alone.

To further disguise the case, the user is instructed to hold the cube with a **random color on top** when solving. The scramble is generated for white-on-top (standard), but the solving orientation is randomized. Since PLL recognition depends heavily on color patterns, a different orientation makes it much harder to identify the case from the scramble alone — which is exactly what we want for recognition practice.

The scramble is computed instantly (no solver needed), so no latency-hiding is required.

### 2-look detection

During the solving phase, each move updates the cube state. After each move, we check whether the state represents a "partial PLL solve":
- Corners fully permuted but edges not → user solved corners first (2-look)
- Edges fully permuted but corners not → user solved edges first (2-look)

This is detected by checking the U-layer piece permutations against the solved state using the existing `case-recognizer` infrastructure.

The 2-look flag is only surfaced to the user if the case is in their known list — if it's an unknown case, 2-looking it is expected.

### Smart case selection (PllCaseSelector)

Weighted random selection from the user's known cases list. Signals:

| Signal | Weight | Description |
|--------|--------|-------------|
| Normalized avg time | 0.40 | `(case_avg - min_avg) / (max_avg - min_avg)` across all known cases. Slower cases get more weight. Cases with no attempts treated as max (1.0). |
| Low attempt count | 0.20 | `1 / log(attempts + 1)` — less practiced cases surface more often |
| 2-look rate | 0.25 | Proportion of recent attempts flagged as 2-look |
| Staleness | 0.15 | Time since last drilled, normalized. Cases not drilled recently get a bump. |

Cases not in the known list are excluded from drill selection entirely.

## Data model

New IndexedDB stores (schema version bump from 1 → 2). This is purely additive — new object stores only, no changes to the existing `solves` store. No migration needed for existing data.

### `pllKnownCases` store

```ts
{
  name: string;        // "Aa", "T", "Jb", etc. (key)
  addedAt: number;     // timestamp
}
```

### `pllAttempts` store

```ts
{
  id: string;          // uuid (key)
  caseName: string;    // "Aa", "T", etc.
  time: number;        // solve duration in ms
  moveCount: number;
  was2Look: boolean;
  timestamp: number;   // when the attempt happened
}
// Indexes: by-case (caseName), by-timestamp (timestamp)
```

### `PllStatsStore` class

Wraps the two stores and provides:
- `getKnownCases()` / `addKnownCase(name)` / `removeKnownCase(name)`
- `recordAttempt(attempt)`
- `getStatsForCase(name)` — returns avg time, attempt count, best time, 2-look rate
- `getAllStats()` — returns stats for all known cases (used by selector and stats UI)

## UI

Single page at `/training/pll` with tab switching between Drill and Learn modes.

### Tab bar

`Drill | Learn | ⚙ Known PLLs`

The gear icon opens a modal with checkboxes for all 21 PLL cases. This modal also appears on first visit if no known cases are configured.

### Drill mode screens

**Solving:** Scramble display, live timer, status text. Case name is hidden during solving.

**Review:** Case name revealed, time (large), stats row (move count, your avg, best), 2-look warning banner if applicable, reference algorithm, "Next Scramble" button.

### Learn mode screens

**Case picker:** Grid of PLL case names (unknown cases), user selects one to learn.

**Practicing:** Case name, algorithm with current-move highlighted (green background), rep counter, "Ready to Test" button.

**Testing:** Case name, "Algorithm hidden" placeholder, progress dots (5 circles, filled green on success, amber for current, gray for remaining).

**Passed:** Congratulations, "Add to known list?" prompt.

### Known PLLs modal

Grid of all 21 PLL case names as toggle chips. Selected = known (highlighted), unselected = unknown. Shows on first visit and accessible anytime via the gear icon.

## Routes

- `/training/pll` — `PllTrainer` component (new)
- `/training` — `TrainingPage` updated to add PLL card alongside existing cross trainer card

## Testing

### Core unit tests (Vitest)

- `pll-drill-session.test.ts` — full lifecycle (idle → selecting → scrambling → ready → solving → review), 2-look detection (flag when intermediate state detected on known case, don't flag on unknown case), move recording, duration calculation
- `pll-learn-session.test.ts` — practicing mode (correct move advances, wrong move requires undo), testing mode (5 completions → passed, wrong moves OK if corrected), rep counting
- `pll-case-selector.test.ts` — weighted selection (slower cases favored, less practiced favored, high 2-look rate favored, staleness bonus), excludes unknown cases
- `pll-stats-store.test.ts` — CRUD on known cases and attempts, stats aggregation (avg time, 2-look rate, attempt count per case)

### Scramble generation test

- Solver produces valid PLL state: apply generated scramble to solved cube → verify only PLL is unsolved (cross, F2L, OLL all solved)

## Limitations and future work

- **Algorithm variants** — currently each PLL has one algorithm from `PLL_CASES`. Users may prefer different algorithms; a future enhancement could let users customize their preferred algorithm per case.
- **No recognition-only mode** — recognition is always combined with execution in drill mode. A dedicated recognition drill (identify the case without solving) could be added later.
- **Weight formula tuning** — the case selection weights are initial values; they may need adjustment based on real usage.
- **Cross face** — drill mode generates PLL states relative to D-face cross. Supporting other cross faces would require adapting the scramble generation. (Same limitation as the cross trainer; could be addressed together.)
- **Minimum data thresholds** — the case selector uses stats from all attempts. Cases with very few attempts may have unreliable averages, but the low-attempt-count signal helps surface them for more data collection.
