# Cross Trainer Fixes & Shared MoveGuide

## Problem

Four related issues in the training tools:

1. **Cross face default is yellow (D), should be white (U).** In cubing.js's default orientation, D = yellow, U = white. The cross trainer defaults to "D", so it solves/detects the yellow cross. CFOP solvers typically practice white cross.

2. **Cross solver hangs at "computing optimal cross solve."** `experimentalSolveTwips` from cubing.js uses web workers. The call has no timeout or logging, so when the worker fails to respond, the UI hangs silently with no diagnostic information.

3. **PLL learn session doesn't handle double moves.** When the algorithm contains R2, the session expects `move === "R2"` exactly. Smart cubes report individual quarter turns (R or R'), so R2 is never matched and the user gets stuck.

4. **ScrambleTracker recovery doesn't collapse double moves.** If the user performs R then R (attempting R2 but on the wrong move), the error stack holds two separate R entries. Recovery demands R' then R' individually, rather than showing "undo R2". Performing additional R turns spawns more R' recovery moves instead of collapsing.

## Design

### Fix 1: Cross face default → "U"

Change the default `crossFace` parameter from `"D"` to `"U"` in:
- `cross-trainer-session.ts` — field initializer and `startScramble` parameter default
- `cross-solver.ts` — `solveOptimalCross` parameter default
- `use-cross-trainer.ts` — if it passes an explicit face, update it

Update tests that assert the default face.

### Fix 2: Cross solver debugging

Add diagnostic logging around the `experimentalSolveTwips` call in `cross-trainer-session.ts`:
- Log when the solver starts (with scramble and target face)
- Log when the solver completes (with solution and elapsed time)
- Add a timeout wrapper (e.g. 30 seconds) that rejects the promise with a clear error message rather than hanging forever
- Surface solver errors in the UI state so the user sees "solver failed" instead of infinite loading

### Fix 3 & 4: MoveGuide utility class

A shared stateful move matcher that handles double-move expansion and error recovery with collapsing.

#### Interface

```typescript
// src/core/move-guide.ts

interface MoveGuideState {
  mode: "tracking" | "recovering";
  position: number;
  isComplete: boolean;
  pendingHalfMove: boolean;
  recoveryMoves: string[];  // moves the user must perform to recover
}

class MoveGuide {
  constructor(moves: string[]);

  get state(): MoveGuideState;
  get expectedMove(): string | null;

  onMove(move: string): void;
  reset(): void;
}
```

#### Tracking mode

When `mode === "tracking"`, `onMove` compares the incoming move against the expected move at `position`:

1. **Exact match** (move === expected): advance `position`. If `position >= moves.length`, set `isComplete = true`.
2. **Expected is a double move, move is a matching quarter turn**: set `pendingHalfMove = true`, store the quarter turn direction.
3. **Pending half move, second quarter turn matches first**: clear pending, advance `position`.
4. **Pending half move, second quarter turn doesn't match**: clear pending, push both the first quarter turn and this move onto the error stack, enter recovery mode.
5. **No match**: push move onto error stack, enter recovery mode.

"Matching quarter turn" means: for expected "R2", both "R" and "R'" are accepted. The second turn must match the direction of the first (both R+R or both R'+R').

#### Recovery mode

When `mode === "recovering"`, the user must undo their wrong moves to get back on track. The error stack tracks what the user has done wrong.

**Collapsing:** When a new move is pushed onto the error stack, check if it's the same face as the top entry. If so, combine the amounts (mod 4). If the combined amount is 0 (they cancel), pop the entry. If the stack becomes empty, return to tracking mode.

This means:
- User does R, R (error): stack = [R2], recovery shows "undo R2"
- User does R, R, R (error): stack = [R'], recovery shows "undo R"
- User does R, R, R, R (error): stack = [], back to tracking (full rotation cancels)

**Recovery matching:** The user must perform the inverse of the top stack entry. For double moves (R2), accept either two R's or two R' — use the same pending-half-move logic as tracking mode, but matching against the required recovery move instead.

When the recovery move is performed, pop the stack entry. When the stack is empty, return to tracking mode.

#### Shared helpers

Extract into `src/core/move-utils.ts`:
- `invertMove(move: string): string` — single move inversion
- `moveFamily(move: string): string` — extract face letter for same-face comparison
- `moveAmount(move: string): number` — extract amount (+1, -1, +2)
- `normalizeAmount(amount: number): number` — mod 4 normalization
- `isDoubleMove(move: string): boolean`
- `isQuarterTurnOf(doubleMove: string, move: string): boolean`
- `buildMoveString(face: string, amount: number): string` — reconstruct move from face + amount

These replace the duplicated private helpers currently in `scramble-tracker.ts`, `pll-learn-session.ts`, and `undo-alg.ts`.

#### Integration: ScrambleTracker

`ScrambleTracker` becomes a thin wrapper around `MoveGuide`:
- Constructor parses the scramble string into moves, creates a `MoveGuide`
- `onMove` delegates to `guide.onMove`
- `state` getter maps from `guide.state` to `ScrambleTrackerState`
- Retains its own listener pattern

The `ScrambleTrackerState` interface stays the same for backward compatibility. The `scrambleMoves` array is derived from the guide's position, and `recoveryMoves` comes directly from the guide's state.

#### Integration: PllLearnSession

Replace `_position`, `_needsUndo`, and the `onMove` body:
- Create a `MoveGuide` in `startPractice` with the parsed face moves
- `onMove` delegates to `guide.onMove`, then checks `guide.state.isComplete` to trigger `onAlgorithmCompleted`
- `expectedMove` delegates to `guide.expectedMove`
- `needsUndo` maps to `guide.state.mode === "recovering"` (the `recoveryMoves` array replaces the single `needsUndo` string)
- On algorithm completion, call `guide.reset()`

The `needsUndo` property type changes from `string | null` to `string[] | null` (recovery can require multiple undo moves). The PLL trainer UI needs a minor update to display recovery moves as a list.

#### Integration: undo-alg.ts

`undo-alg.ts` imports helpers from `move-utils.ts` instead of defining its own. Its `computeUndoAlg` function stays as-is (it operates on completed move sequences, not live tracking).

### Testing

#### MoveGuide tests (`src/core/__tests__/move-guide.test.ts`)

- Quarter turn exact match advances position
- Double move matched by two same-direction quarter turns (R+R)
- Double move matched by two opposite-direction quarter turns (R'+R')
- Wrong move enters recovery mode
- Recovery: single wrong move, undo with inverse
- Recovery: double move error (R+R when wrong), collapsed to R2, undo with R2
- Recovery: three same-face moves collapse to R'
- Recovery: four same-face moves cancel out, return to tracking
- Recovery from double-move undo accepts two quarter turns
- Wrong move during pending half pushes both moves
- Complete sequence with mixed singles and doubles
- Reset returns to position 0, tracking mode

#### Updated ScrambleTracker tests

Existing tests should continue to pass (behavior is the same, implementation delegates to MoveGuide). Add tests for the recovery collapsing behavior that was previously broken.

#### Updated PllLearnSession tests

Update tests to reflect that `needsUndo` returns `string[]` instead of `string`. Add tests for double-move steps in algorithms.

## Files changed

New files:
- `src/core/move-guide.ts`
- `src/core/move-utils.ts`
- `src/core/__tests__/move-guide.test.ts`
- `src/core/__tests__/move-utils.test.ts`

Modified files:
- `src/core/cross-trainer-session.ts` — default face "D" → "U"
- `src/core/cross-solver.ts` — default face "D" → "U", add timeout + logging
- `src/features/training/use-cross-trainer.ts` — update if needed
- `src/core/__tests__/cross-trainer-session.test.ts` — update default face assertions
- `src/core/__tests__/cross-solver.test.ts` — update default face assertions
- `src/core/scramble-tracker.ts` — delegate to MoveGuide, remove duplicated helpers
- `src/core/pll-learn-session.ts` — delegate to MoveGuide, remove duplicated helpers
- `src/core/undo-alg.ts` — import from move-utils instead of defining own helpers
- `src/core/__tests__/scramble-tracker.test.ts` — add recovery collapsing tests
- `src/core/__tests__/pll-learn-session.test.ts` — update for new needsUndo type, add double-move tests
- `src/features/pll-trainer/PllTrainer.tsx` or equivalent — update recovery display for string[]
