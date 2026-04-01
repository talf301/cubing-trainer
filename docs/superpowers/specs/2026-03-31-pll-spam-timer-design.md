# PLL Spam Timer — Design Spec

## Overview

An always-on timer page for rapid-fire PLL execution practice. The user connects their smart cube, navigates to the spam timer page, and starts executing PLL algorithms. The app automatically detects each PLL completion, identifies the case, and records the time. A separate stats view ranks all 21 PLLs by a top-percentile speed metric with sparkline trend graphs.

## Core Detection Engine

### PLL Completion Detection

A new `PllSpamSession` class in `src/core/pll-spam-session.ts`. Framework-agnostic, receives moves via the same `onMove(move, timestamp, stateAfterMove)` interface used by existing session classes.

**Detection condition:** F2L solved AND last layer oriented (OLL complete). This condition holds true regardless of whether the cube is fully solved or in a PLL-permuted state, so the user can chain PLLs endlessly without returning to a solved state.

**Flow:**

1. Session tracks a "baseline" state — the last state where the detection condition was met. Initially null; set when the condition is first observed (e.g., user starts from a solved cube).
2. On each move, check: is F2L solved and LL oriented?
   - **No** → mid-algorithm, continue.
   - **Yes** → Candidate PLL completion. Check move count since baseline (see filtering below). If valid, identify the PLL case, emit a completion event, update baseline, reset move tracking.
3. First move after a completion sets the timing start for the next PLL.

**PLL Case Identification:** Compare the LL permutation between the baseline state and the current state. The permutation delta corresponds to the PLL that was executed. Reuse the existing fingerprint matching from `case-recognizer.ts` / `pll-cases.ts` — apply the 21 PLL fingerprints against the permutation of LL corner and edge pieces.

### Edge Case Handling

- **AUF moves between PLLs:** U-layer turns on a PLL-complete state still satisfy the detection condition (F2L solved, LL oriented). A minimum move count threshold of **4 moves** filters these out — no PLL algorithm is shorter than ~5 face moves.
- **Non-PLL move sequences that restore the condition:** The 4-move minimum handles most false positives. If a sequence restores F2L + LL-oriented but doesn't match any PLL fingerprint, the attempt is discarded (no case identified).
- **User picks up / puts down cube:** No moves = no triggers. Natural inactivity is fine.
- **Cube disconnects mid-algorithm:** Session resets baseline to null. Next time the detection condition is observed, a new baseline is established.

## Data Storage

### IndexedDB Store

New object store `pllSpamAttempts` in the existing database, following the same pattern as `pllAttempts`:

```typescript
interface PllSpamAttempt {
  id: string;           // UUID
  caseName: string;     // PLL case name: "T", "Aa", "Rb", etc.
  time: number;         // Execution time in milliseconds
  moveCount: number;    // Number of moves in the execution
  timestamp: number;    // Unix timestamp of completion
}
```

Indexes: `by-case` (caseName) and `by-timestamp` (timestamp).

### Store Class

`PllSpamStore` in `src/lib/pll-spam-store.ts`:
- `addAttempt(attempt)` — persist to IndexedDB
- `getAttemptsByCase(caseName)` — for per-case stats
- `getAllAttempts()` — for ranking computation

## Stats Computation

### Top-Percentile Metric

Pure utility function in `src/lib/pll-spam-stats.ts`:

```typescript
function topPercentMetric(times: number[], pct = 0.05): number
```

Returns the mean of the top `ceil(n * pct)` fastest times. This naturally scales:
- < 20 attempts: best single (ceil rounds up to 1)
- 40 attempts: average of best 2
- 100 attempts: average of best 5
- etc.

### Sparkline Data

Compute the top-percentile metric at regular intervals (every 5 attempts) to produce a time series for trend visualization. Each data point is the top-percentile metric computed over all attempts up to that point. Function signature:

```typescript
function sparklineData(times: number[], pct?: number, interval?: number): number[]
```

## UI — Timer Page

Route: `/pll-spam` (or similar, added to `routes.tsx`)

Page: `SpamTimerPage.tsx` in `src/features/pll-spam/`

### Layout

- **Top section:** Large time display + detected PLL case name. PB indicator ("NEW PB") shown when the attempt is the fastest recorded for that case.
- **Bottom section:** Scrolling log of recent attempts in the current page visit. Each row shows case name and time. PB attempts highlighted.
- **No start/stop controls.** The page is always listening when a smart cube is connected. First move starts timing, PLL detection stops it. The cycle repeats automatically.
- **No explicit session concept.** The scrolling log is ephemeral (current page visit only). All attempts are persisted to IndexedDB regardless.

### React Hook

`useSpamTimer(connection)` in `src/features/pll-spam/use-spam-timer.ts`:
- Creates and manages a `PllSpamSession` instance
- Subscribes to cube move events
- Persists completions to `PllSpamStore`
- Exposes: `lastAttempt`, `recentAttempts` (ephemeral list), `isPB` flag

## UI — Stats Page

Route: `/pll-spam/stats` (or similar)

Page: `SpamStatsPage.tsx` in `src/features/pll-spam/`

### Layout

**Summary cards** at top:
- Total attempts across all cases
- Overall top-5% average (across all cases, or mean of per-case metrics)
- Cases covered (e.g., "19/21")

**Ranked list** below:
- All 21 PLLs sorted by top-5% metric (fastest first)
- Each row: rank, case name, top-5% time, attempt count, sparkline
- Color coding: green for fast times, red for slow (relative to the user's own range)
- Cases with no attempts shown at bottom, grayed out

## File Structure

```
src/
  core/
    pll-spam-session.ts         # Detection engine
    pll-spam-session.test.ts
  lib/
    pll-spam-store.ts           # IndexedDB persistence
    pll-spam-stats.ts           # Stats computation utilities
    pll-spam-stats.test.ts
  features/
    pll-spam/
      SpamTimerPage.tsx         # Always-on timer page
      SpamStatsPage.tsx         # Rankings + sparklines
      use-spam-timer.ts         # React hook
```

Plus route additions in `src/app/routes.tsx` and DB schema update in `src/lib/db.ts`.

## Dependencies

- Existing `case-recognizer.ts` — PLL fingerprint matching
- Existing `pll-cases.ts` — PLL case definitions and fingerprints
- Existing `cfop-segmenter.ts` — F2L-solved and OLL-solved detection functions
- Existing `cube-connection.ts` interface — move events from smart cube
- `idb` — IndexedDB access (already a project dependency)

## Out of Scope

- Sound or haptic feedback on PB
- Per-case detail view (tap a PLL to see all attempts)
- OLL spam timer (same concept but for OLL cases)
- Manual timing / non-smart-cube mode
- Session grouping or session-level analytics
