# Unified Scramble Tracking

## Problem

Three features (timer, cross trainer, LL trainer) each independently wire up `ScrambleTracker` to bluetooth cube events and React state. The wiring differs across features:

- **Timer & cross trainer** create the tracker in the React hook, subscribe via `addStateListener`, and detect scramble completion by comparing cube state to the expected pattern (`currentState.isIdentical(expectedState)`). The tracker is display-only.
- **LL trainer** creates the tracker inside the session class, polls state via a getter (no listener), and detects completion via `scrambleTracker.state.isComplete`. This makes it dependent on the tracker's move-by-move accuracy.

This divergence causes bugs to resurface. The R2 blocking issue (where `R2` requires `R` or `R'` first, both of which the tracker initially rejects) was fixed in the core `MoveGuide` but the LL trainer's different completion path means tracker bugs can still block progress.

## Design

### Principle

The `ScrambleTracker` is a **display concern** — it shows the user which moves they've completed and guides error recovery. Scramble **completion detection** is a **domain concern** — it belongs in the session class and should compare actual cube state to expected state.

### 1. Shared hook: `useScrambleTracking`

**File:** `src/hooks/use-scramble-tracking.ts`

```ts
function useScrambleTracking(
  connection: CubeConnection,
  scramble: string | null,
): {
  trackerState: ScrambleTrackerState | null;
  feedMove: (move: string) => void;
}
```

- Creates a `ScrambleTracker` when `scramble` transitions from `null` to a string.
- Subscribes via `addStateListener(setTrackerState)` so React sees new state objects on every move.
- Manages the 500ms GAN buffer flush delay internally. `feedMove` is a no-op during this window.
- Destroys the tracker and resets `trackerState` to `null` when `scramble` transitions to `null`.
- Callers control the tracker lifecycle by passing `scramble` during the scrambling phase and `null` otherwise.

### 2. Fix `LLPracticeSession`: state-based completion

Remove `ScrambleTracker` from `LLPracticeSession`. It should not import or reference the tracker at all.

Change `handleScrambling` to compare cube state:

```ts
private handleScrambling(
  _move: string,
  timestamp: number,
  stateAfterMove: KPattern,
  _geometry: FaceGeometry,
): void {
  if (!this.expectedState) return;
  if (stateAfterMove.isIdentical(this.expectedState)) {
    // Scramble complete — transition to solving_oll
    this.ollSegmentStart = timestamp;
    this.ollFirstMoveTime = null;
    this.f2lBroken = false;
    this.ollSegmentState = this.expectedState;
    this.setPhase("solving_oll");
  }
}
```

Remove the `scrambleTrackerState` getter and the `scrambleTracker` field.

### 3. Refactor feature hooks

Each hook replaces its inline tracker management with `useScrambleTracking()`.

**`use-solve-session.ts`:**
- Remove: `trackerRef`, `trackerReadyAtRef`, tracker creation in `startNewSolve`, `addStateListener`/`removeStateListener` calls, tracker cleanup in phase listener.
- Add: `const { trackerState, feedMove } = useScrambleTracking(connection, phase === "scrambling" ? scramble : null);`
- In the move handler's scrambling branch: call `feedMove(moveStr)` instead of `trackerRef.current.onMove(moveStr)`.
- Return `trackerState` from the hook result (already does, just sourced differently now).

**`use-cross-trainer.ts`:**
- Same changes as `use-solve-session`.

**`use-ll-practice.ts`:**
- Remove: `trackerState` local state, `trackerReadyAtRef`, all `setTrackerState` calls, `session.scrambleTrackerState` reads.
- Add: `const { trackerState, feedMove } = useScrambleTracking(connection, phase === "scrambling" ? scramble : null);`
- In the move handler: call `feedMove(moveStr)` alongside `session.onMove(...)` during scrambling.
- The hook no longer needs to poll tracker state after moves or phase changes.

### 4. No changes to core classes

`ScrambleTracker`, `MoveGuide`, and `move-utils` remain unchanged. The bug is in the wiring, not the core logic.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/use-scramble-tracking.ts` | **New** — shared hook |
| `src/core/ll-practice-session.ts` | Remove `ScrambleTracker` import/usage, use state-based completion |
| `src/features/solve/use-solve-session.ts` | Replace inline tracker management with `useScrambleTracking` |
| `src/features/training/use-cross-trainer.ts` | Replace inline tracker management with `useScrambleTracking` |
| `src/features/ll-trainer/use-ll-practice.ts` | Replace inline tracker management with `useScrambleTracking` |

## Testing

- Existing `scramble-tracker.test.ts` and `move-guide.test.ts` are unaffected.
- The shared hook is thin React glue — lifecycle management, not logic. Manual testing with a GAN cube covers the integration (tracker progress display, R2 handling, completion detection across all three features).
- `LLPracticeSession` tests (if any) should verify that `handleScrambling` transitions on state match, not on `isComplete`.
