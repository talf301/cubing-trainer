# Cross Trainer — Design Spec

## Overview

A dedicated training mode for practicing the cross step of CFOP. The user connects a bluetooth cube, scrambles to a generated position, solves just the D-face cross, and then reviews their solution side-by-side with the optimal one. The goal is to help the user develop efficient cross solutions through immediate feedback.

## Motivation

The cross is the first step of every CFOP solve and directly sets the pace for everything that follows. Small inefficiencies compound: an 8-move cross where 5 moves would do costs ~1 second per solve. The trainer targets this by:

1. Isolating the cross step so it can be drilled independently of the rest of the solve.
2. Computing the optimal solution during the scrambling phase, so feedback is instant.
3. Showing an undo/redo path so the user can physically replay the optimal solution on their cube.

## Architecture

### Layers

```
Routes (/training, /training/cross)
  └─ CrossTrainer.tsx           — UI: timer, review panels, connection
       └─ useCrossTrainer hook  — orchestrates session, connection, scramble tracker, timer
            ├─ CrossTrainerSession   — state machine (core logic, no React)
            ├─ ScrambleTracker       — tracks scramble application progress
            ├─ solveOptimalCross     — cubing.js optimal solver wrapper
            └─ CubeConnection        — bluetooth cube abstraction
```

The core logic (`CrossTrainerSession`) is framework-agnostic. The React hook (`useCrossTrainer`) bridges it to the UI. This follows the same pattern used in the existing `SolveSession` / `useSolveSession` split.

### State machine

`CrossTrainerSession` manages a five-phase lifecycle:

```
idle → scrambling → ready → solving → review
                                         │
                                         └─ reset() → idle
```

- **idle** — waiting for a scramble to be issued
- **scrambling** — scramble generated, user is applying it to the physical cube; optimal solver kicked off in the background
- **ready** — cube state matches the expected scramble; timer is armed
- **solving** — first move detected, timer running, moves recorded; each move is checked against `isCrossSolved` for the D face
- **review** — cross detected as solved; timer stopped, result assembled (user moves, duration, undo alg, optimal alg)

Phase transitions emit events via a listener pattern so the React layer can react without polling.

### Optimal cross solver

`solveOptimalCross` wraps cubing.js `experimentalSolveTwips` with a target pattern where only the 4 D-face cross edges are constrained (solved position and orientation). All other pieces use `orientationMod: 1` (don't-care). This lets the solver find the shortest move sequence that places exactly those 4 edges correctly, ignoring everything else.

The solver is kicked off as soon as the scramble is generated (during the `scrambling` phase), not after the user finishes. This hides the solver latency behind the time the user spends applying the scramble.

### Undo algorithm

After the user solves the cross, `computeUndoAlg` produces the inverse of their moves (reversed order, each move inverted) and collapses consecutive same-face moves into half-turn metric notation. This gives the user a way to undo their cross on the physical cube, then re-apply the optimal solution to feel the difference.

### React hook — `useCrossTrainer`

Orchestrates:

- **Connection status** — mirrors `CubeConnection` status; auto-starts first scramble on connect
- **Scramble tracking** — creates a `ScrambleTracker` per scramble to show progress in the UI; adds a 500ms debounce before accepting moves (prevents accidental early tracking)
- **Timer** — wall-clock `setInterval` at 10ms during solving; switches to session's authoritative duration on review
- **Move routing** — during scrambling, feeds moves to both `ScrambleTracker` and `session.onCubeState`; during ready/solving, feeds to `session.onMove`
- **Result fetching** — on review, awaits `session.getResult()` which resolves the optimal solver promise if still pending

### UI — `CrossTrainer.tsx`

Single-page layout with phases driving visibility:

| Phase | Shown |
|-------|-------|
| idle (disconnected) | Connect Cube button |
| scrambling | Scramble display with move-by-move progress |
| ready | Timer at 0:00.00, prompt text |
| solving | Live timer |
| review | Time, Your Cross vs Optimal panels (side-by-side on desktop), undo/redo section, Next Scramble button |

The review panel shows move counts for both solutions so the user can immediately see the gap.

### Routes

- `/training` — `TrainingPage` with a card grid of available training modes (currently just cross)
- `/training/cross` — `CrossTrainer` component

## Cross detection

Uses the existing `isCrossSolved` function from `cfop-segmenter.ts`, which checks the 4 cross edges for the target face via `buildFaceGeometry`. This is the same detection used in CFOP segmentation, so behavior is consistent across the app.

Currently hardcoded to D-face cross (`D_FACE_IDX = 5`). The any-cross-face plan (`2026-03-21-any-cross-face-detection.md`) is a natural follow-up.

## Testing

`cross-trainer-session.test.ts` covers:

- Full lifecycle: idle → scrambling → ready → solving → review
- State match / mismatch during scrambling
- Move recording with relative timestamps
- Duration calculation
- Phase listener add/remove
- `getResult()` returns moves, duration, undo alg, optimal alg (or null)
- Reset returns to idle

`cross-solver.test.ts` covers:

- Optimal solution for a simple scramble is at most 1 move
- Solver produces valid moves (no crashes)

## Limitations and future work

- **D-face only** — cross face is hardcoded; any-face support is planned separately
- **No history/persistence** — results are ephemeral; a future phase could store cross times in IndexedDB alongside full solve records
- **No move-by-move replay** — the review shows algorithms as text; an animated 3D replay could be added later
- **No statistics** — averages, trends, and move-count distributions are not yet tracked
