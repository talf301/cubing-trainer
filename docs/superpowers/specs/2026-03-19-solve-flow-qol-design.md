# Solve Flow QoL Improvements — Design Spec

## Goal

Streamline the scramble→solve loop by removing manual button clicks, adding scramble
progress feedback with color-coded moves, and guiding error recovery during scrambling.

## Changes

### 1. Auto-flow (no buttons)

- On cube connect: auto-generate the first scramble, transition straight to `scrambling`.
  Trigger: `useSolveSession` subscribes to the connection's status listener. When status
  changes to `"connected"` and the session is in `idle` phase, auto-call `startNewSolve()`.
- On solve complete: save the solve, immediately generate the next scramble and
  transition to `scrambling`. No pause, no button.
- Remove the Start / Next Solve button entirely.

### 2. Timer display behavior

- **scrambling phase:** Display the previous solve's time (or 0.00 if no previous solve).
- **ready phase:** Display 0.00.
- **solving phase:** Live counting timer.
- **solved phase:** Final solve time. Auto-advance to next scramble is immediate — the
  timer continues showing this solve's time through the next scrambling phase per above.

### 3. Scramble progress display

During the `scrambling` phase, the scramble is rendered as individual colored moves:

- **Completed moves** (index < currentPosition): green
- **Upcoming moves** (index >= currentPosition): default white

When the user performs a physical move that matches the next expected scramble move,
the position advances and that move turns green.

### 4. Error recovery during scrambling

When a wrong move is made during scrambling:

- The wrong move is pushed onto an error stack.
- The scramble display is **replaced** by the error recovery sequence: the inverses
  of the error stack, displayed in red.
- As the user performs each fix move, the corresponding entry disappears from the
  recovery display (popped from the stack).
- During recovery, the next expected move is the top of the recovery sequence (the
  inverse of the most recent wrong move). If the user performs that move, it is popped.
  If the user performs any other move, it is treated as another wrong move and pushed
  onto the error stack, extending the recovery sequence.
- Once the error stack is empty, the normal scramble progress display returns at the
  same position.

### 5. Move matching

A scramble move like `R2` means "turn R face 180 degrees." The user must perform
exactly the move notation says — `R2` matches `R2`, not two separate `R` moves.
Standard WCA notation: `R`, `R'`, `R2`, `U`, `U'`, `U2`, etc.

Move matching compares `move.toString()` output from the physical move against the
scramble move string. Both use cubing.js standard notation (e.g., `R`, `R'`, `R2`) so
the formats are guaranteed identical. The scramble string from `generateScramble()` is
split on whitespace to produce the move list for `ScrambleTracker`.

## Architecture

### ScrambleTracker (new, framework-agnostic)

`src/core/scramble-tracker.ts`

Receives physical moves, tracks position in the scramble, manages error state.

```typescript
interface ScrambleTrackerState {
  mode: "tracking" | "recovering";
  // In tracking mode: moves with completion status
  scrambleMoves: { move: string; completed: boolean }[];
  // In recovering mode: fix moves remaining (displayed in red)
  recoveryMoves: string[];
  // True when all scramble moves completed
  isComplete: boolean;
}

class ScrambleTracker {
  constructor(scramble: string) // splits on whitespace internally
  onMove(move: string): void
  get state(): ScrambleTrackerState
  addStateListener(cb: (state: ScrambleTrackerState) => void): void
  removeStateListener(cb: (state: ScrambleTrackerState) => void): void
}
```

**Inverse computation:** Use cubing.js `Move` class — `new Move(moveStr).invert().toString()`
to get the inverse of a move.

### Changes to existing code

- **`use-solve-session.ts`:** Create a `ScrambleTracker` when entering scrambling phase.
  Feed physical moves to it. Expose tracker state to UI. Auto-generate scramble on
  connect and on solve complete. Timer display logic: keep previous solve time during
  scrambling, show 0 in ready, live count in solving.
- **`SolvePage.tsx`:** Remove Start/Next button. Render scramble moves with colors
  (green/white/red) instead of plain text. Show recovery moves when in error state.
- **`SolveSession`:** No changes needed — the tracker is a separate concern that runs
  alongside the session during the scrambling phase.

## Out of scope

- Sound/haptic feedback on errors
- Scramble visualization (2D/3D diagram)
- Configurable auto-advance delay
