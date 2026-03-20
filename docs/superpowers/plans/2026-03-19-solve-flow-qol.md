# Solve Flow QoL Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove manual buttons from the solve loop, add color-coded scramble progress with error recovery guidance, and refine timer display behavior.

**Architecture:** A new framework-agnostic `ScrambleTracker` in `src/core/` tracks position in the scramble and manages error recovery state. The existing `useSolveSession` hook is updated to auto-generate scrambles on connect/solve-complete, manage timer display across phases, and expose tracker state. `SolvePage` renders colored moves and recovery sequences.

**Tech Stack:** cubing.js (alg/Move for inversion), React, TypeScript, Vitest

---

## File Structure

```
src/core/
  scramble-tracker.ts           — ScrambleTracker class: tracks scramble progress + error recovery
  __tests__/scramble-tracker.test.ts — Unit tests for ScrambleTracker

src/features/solve/
  use-solve-session.ts          — Modify: auto-flow, timer display, ScrambleTracker integration
  SolvePage.tsx                 — Modify: remove buttons, render colored scramble moves
  ScrambleDisplay.tsx           — New: renders scramble progress or recovery sequence
```

---

## Task 1: ScrambleTracker core logic

**Files:**
- Create: `src/core/scramble-tracker.ts`
- Create: `src/core/__tests__/scramble-tracker.test.ts`

- [ ] **Step 1: Write tests for tracking mode**

```typescript
// src/core/__tests__/scramble-tracker.test.ts
import { describe, it, expect } from "vitest";
import { ScrambleTracker } from "@/core/scramble-tracker";

describe("ScrambleTracker", () => {
  describe("tracking mode", () => {
    it("initializes with all moves incomplete", () => {
      const tracker = new ScrambleTracker("R U F");
      const state = tracker.state;
      expect(state.mode).toBe("tracking");
      expect(state.scrambleMoves).toEqual([
        { move: "R", completed: false },
        { move: "U", completed: false },
        { move: "F", completed: false },
      ]);
      expect(state.isComplete).toBe(false);
    });

    it("marks move as completed when correct move is made", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("R");
      const state = tracker.state;
      expect(state.scrambleMoves[0].completed).toBe(true);
      expect(state.scrambleMoves[1].completed).toBe(false);
      expect(state.mode).toBe("tracking");
    });

    it("tracks multiple correct moves in sequence", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("R");
      tracker.onMove("U");
      expect(tracker.state.scrambleMoves[0].completed).toBe(true);
      expect(tracker.state.scrambleMoves[1].completed).toBe(true);
      expect(tracker.state.scrambleMoves[2].completed).toBe(false);
    });

    it("reports complete when all moves done", () => {
      const tracker = new ScrambleTracker("R U");
      tracker.onMove("R");
      tracker.onMove("U");
      expect(tracker.state.isComplete).toBe(true);
    });

    it("handles prime moves", () => {
      const tracker = new ScrambleTracker("R' U2 F");
      tracker.onMove("R'");
      expect(tracker.state.scrambleMoves[0].completed).toBe(true);
      tracker.onMove("U2");
      expect(tracker.state.scrambleMoves[1].completed).toBe(true);
    });
  });

  describe("error recovery", () => {
    it("enters recovering mode on wrong move", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("L"); // wrong
      const state = tracker.state;
      expect(state.mode).toBe("recovering");
      expect(state.recoveryMoves).toEqual(["L'"]);
    });

    it("exits recovering mode when fix move is performed", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("L"); // wrong
      tracker.onMove("L'"); // fix
      const state = tracker.state;
      expect(state.mode).toBe("tracking");
      expect(state.recoveryMoves).toEqual([]);
      expect(state.scrambleMoves[0].completed).toBe(false); // still at position 0
    });

    it("stacks multiple wrong moves", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("L"); // wrong
      tracker.onMove("D"); // wrong again
      const state = tracker.state;
      expect(state.mode).toBe("recovering");
      expect(state.recoveryMoves).toEqual(["D'", "L'"]);
    });

    it("pops recovery moves one at a time", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("L"); // wrong
      tracker.onMove("D"); // wrong
      tracker.onMove("D'"); // fix top
      expect(tracker.state.recoveryMoves).toEqual(["L'"]);
      tracker.onMove("L'"); // fix remaining
      expect(tracker.state.mode).toBe("tracking");
    });

    it("handles wrong move during recovery", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("L"); // wrong → recovery: ["L'"]
      tracker.onMove("F"); // wrong again → recovery: ["F'", "L'"]
      expect(tracker.state.recoveryMoves).toEqual(["F'", "L'"]);
    });

    it("resumes tracking at same position after recovery", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("R"); // correct, position 1
      tracker.onMove("L"); // wrong
      tracker.onMove("L'"); // fix
      tracker.onMove("U"); // correct, position 2
      expect(tracker.state.scrambleMoves[0].completed).toBe(true);
      expect(tracker.state.scrambleMoves[1].completed).toBe(true);
      expect(tracker.state.scrambleMoves[2].completed).toBe(false);
    });

    it("handles double move inversion correctly", () => {
      const tracker = new ScrambleTracker("R U F");
      tracker.onMove("U2"); // wrong
      expect(tracker.state.recoveryMoves).toEqual(["U2"]);
    });
  });

  describe("state listener", () => {
    it("emits state changes on each move", () => {
      const tracker = new ScrambleTracker("R U");
      const states: string[] = [];
      tracker.addStateListener((state) => states.push(state.mode));

      tracker.onMove("R"); // tracking
      tracker.onMove("L"); // recovering
      tracker.onMove("L'"); // tracking
      tracker.onMove("U"); // tracking (complete)

      expect(states).toEqual(["tracking", "recovering", "tracking", "tracking"]);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/core/__tests__/scramble-tracker.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write ScrambleTracker implementation**

```typescript
// src/core/scramble-tracker.ts
import { Move } from "cubing/alg";

export interface ScrambleTrackerState {
  mode: "tracking" | "recovering";
  scrambleMoves: { move: string; completed: boolean }[];
  recoveryMoves: string[];
  isComplete: boolean;
}

export class ScrambleTracker {
  private moves: string[];
  private position: number = 0;
  private errorStack: string[] = [];
  private listeners = new Set<(state: ScrambleTrackerState) => void>();

  constructor(scramble: string) {
    this.moves = scramble.split(/\s+/).filter((s) => s.length > 0);
  }

  get state(): ScrambleTrackerState {
    return {
      mode: this.errorStack.length > 0 ? "recovering" : "tracking",
      scrambleMoves: this.moves.map((move, i) => ({
        move,
        completed: i < this.position,
      })),
      recoveryMoves: this.errorStack.map((m) => invertMove(m)),
      isComplete: this.position >= this.moves.length,
    };
  }

  onMove(move: string): void {
    if (this.errorStack.length > 0) {
      // In recovery mode
      const expectedFix = invertMove(this.errorStack[this.errorStack.length - 1]);
      if (move === expectedFix) {
        this.errorStack.pop();
      } else {
        this.errorStack.push(move);
      }
    } else {
      // In tracking mode
      if (this.position < this.moves.length && move === this.moves[this.position]) {
        this.position++;
      } else if (this.position < this.moves.length) {
        this.errorStack.push(move);
      }
    }
    this.emit();
  }

  addStateListener(cb: (state: ScrambleTrackerState) => void): void {
    this.listeners.add(cb);
  }

  removeStateListener(cb: (state: ScrambleTrackerState) => void): void {
    this.listeners.delete(cb);
  }

  private emit(): void {
    const s = this.state;
    for (const cb of this.listeners) {
      cb(s);
    }
  }
}

function invertMove(moveStr: string): string {
  return new Move(moveStr).invert().toString();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/core/__tests__/scramble-tracker.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/scramble-tracker.ts src/core/__tests__/scramble-tracker.test.ts
git commit -m "feat: add ScrambleTracker for scramble progress and error recovery"
```

---

## Task 2: Update useSolveSession hook — auto-flow and timer display

**Files:**
- Modify: `src/features/solve/use-solve-session.ts`

This task updates the hook for:
1. Auto-generate scramble on cube connect
2. Auto-generate next scramble on solve complete
3. Timer display: show previous solve time during scrambling, 0 during ready, live during solving
4. Create and expose ScrambleTracker during scrambling phase

- [ ] **Step 1: Write the updated hook**

Replace the contents of `src/features/solve/use-solve-session.ts` with:

```typescript
// src/features/solve/use-solve-session.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { CubeConnection, CubeMoveEvent } from "@/core/cube-connection";
import { SolveSession, type SolvePhase } from "@/core/solve-session";
import { ScrambleTracker, type ScrambleTrackerState } from "@/core/scramble-tracker";
import { generateScramble } from "@/lib/scramble";
import { SolveStore, type StoredSolve } from "@/lib/solve-store";

const solveStore = new SolveStore();

export function useSolveSession(connection: CubeConnection) {
  const sessionRef = useRef(new SolveSession());
  const trackerRef = useRef<ScrambleTracker | null>(null);
  const [phase, setPhase] = useState<SolvePhase>("idle");
  const [scramble, setScramble] = useState<string>("");
  const [displayMs, setDisplayMs] = useState(0);
  const [trackerState, setTrackerState] = useState<ScrambleTrackerState | null>(null);
  const [recentSolves, setRecentSolves] = useState<StoredSolve[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solveStartWallRef = useRef(0);
  const lastSolveDurationRef = useRef(0);

  // Load recent solves on mount
  useEffect(() => {
    solveStore.getAll().then(setRecentSolves);
  }, []);

  const startNewSolve = useCallback(async () => {
    const result = await generateScramble();
    setScramble(result.scramble);

    // Create a new ScrambleTracker for this scramble
    const tracker = new ScrambleTracker(result.scramble);
    trackerRef.current = tracker;
    setTrackerState(tracker.state);
    tracker.addStateListener(setTrackerState);

    // Show previous solve time during scrambling
    setDisplayMs(lastSolveDurationRef.current);

    sessionRef.current.startScramble(result.scramble, result.expectedState);
  }, []);

  // Auto-generate scramble on connect
  useEffect(() => {
    const onStatus = (status: string) => {
      if (status === "connected" && sessionRef.current.phase === "idle") {
        startNewSolve();
      }
    };

    // Check if already connected
    if (connection.status === "connected" && sessionRef.current.phase === "idle") {
      startNewSolve();
    }

    connection.addStatusListener(onStatus);
    return () => connection.removeStatusListener(onStatus);
  }, [connection, startNewSolve]);

  // Listen to phase changes
  useEffect(() => {
    const session = sessionRef.current;
    const onPhase = (newPhase: SolvePhase) => {
      setPhase(newPhase);

      if (newPhase === "ready") {
        // Clean up tracker
        if (trackerRef.current) {
          trackerRef.current.removeStateListener(setTrackerState);
          trackerRef.current = null;
          setTrackerState(null);
        }
        // Show 0 while waiting to solve
        setDisplayMs(0);
      }

      if (newPhase === "solving") {
        solveStartWallRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setDisplayMs(Date.now() - solveStartWallRef.current);
        }, 10);
      }

      if (newPhase === "solved") {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setDisplayMs(session.duration);
        lastSolveDurationRef.current = session.duration;

        // Save the completed solve
        const solve: StoredSolve = {
          id: crypto.randomUUID(),
          scramble: session.scramble,
          moves: [...session.moves],
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          createdAt: Date.now(),
        };
        solveStore.save(solve).then(() => {
          solveStore.getAll().then(setRecentSolves);
        });

        // Auto-advance to next scramble
        startNewSolve();
      }
    };

    session.addPhaseListener(onPhase);
    return () => {
      session.removePhaseListener(onPhase);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startNewSolve]);

  // Listen to cube moves and feed them to session + tracker
  useEffect(() => {
    const session = sessionRef.current;

    const onMove = (event: CubeMoveEvent) => {
      const moveStr = event.move.toString();

      if (session.phase === "scrambling") {
        // Feed move to tracker for progress display
        if (trackerRef.current) {
          trackerRef.current.onMove(moveStr);
        }
        // Check if scramble state matches
        session.onCubeState(event.state);
      } else if (session.phase === "ready" || session.phase === "solving") {
        session.onMove(moveStr, event.timestamp, event.state);
      }
    };

    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection]);

  return {
    phase,
    scramble,
    displayMs,
    trackerState,
    recentSolves,
  };
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors (may have unused import warnings from SolvePage which we update next)

- [ ] **Step 3: Commit**

```bash
git add src/features/solve/use-solve-session.ts
git commit -m "feat: auto-flow scramble generation, timer display, and tracker integration"
```

---

## Task 3: ScrambleDisplay component and SolvePage update

**Files:**
- Create: `src/features/solve/ScrambleDisplay.tsx`
- Modify: `src/features/solve/SolvePage.tsx`

- [ ] **Step 1: Write the ScrambleDisplay component**

```typescript
// src/features/solve/ScrambleDisplay.tsx
import type { ScrambleTrackerState } from "@/core/scramble-tracker";

interface ScrambleDisplayProps {
  trackerState: ScrambleTrackerState;
}

export function ScrambleDisplay({ trackerState }: ScrambleDisplayProps) {
  if (trackerState.mode === "recovering") {
    return (
      <div className="flex flex-wrap justify-center gap-2 font-mono text-xl">
        {trackerState.recoveryMoves.map((move, i) => (
          <span key={i} className="text-red-400">
            {move}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap justify-center gap-2 font-mono text-xl">
      {trackerState.scrambleMoves.map((move, i) => (
        <span
          key={i}
          className={move.completed ? "text-green-400" : "text-white"}
        >
          {move.move}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Update SolvePage**

Replace the contents of `src/features/solve/SolvePage.tsx` with:

```typescript
// src/features/solve/SolvePage.tsx
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { useSolveSession } from "./use-solve-session";
import { SolveHistory, formatTime } from "./SolveHistory";
import { ScrambleDisplay } from "./ScrambleDisplay";

interface SolvePageProps {
  connection: CubeConnection;
}

const PHASE_LABELS: Record<string, string> = {
  idle: "Connect your cube to begin",
  scrambling: "",
  ready: "Scramble verified — start solving!",
  solving: "",
  solved: "Solved!",
};

export function SolvePage({ connection }: SolvePageProps) {
  const { status, connect } = useCubeConnection(connection);
  const { phase, displayMs, trackerState, recentSolves } =
    useSolveSession(connection);

  const isConnected = status === "connected";

  return (
    <div className="space-y-8">
      {/* Connection status */}
      {!isConnected && (
        <div className="text-center">
          <button
            onClick={connect}
            disabled={status === "connecting"}
            className="rounded bg-blue-600 px-6 py-3 text-lg font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting..." : "Connect Cube"}
          </button>
        </div>
      )}

      {/* Scramble display with progress */}
      {phase === "scrambling" && trackerState && (
        <div className="text-center">
          <ScrambleDisplay trackerState={trackerState} />
        </div>
      )}

      {/* Timer */}
      <div className="text-center">
        <p className="font-mono text-6xl font-bold tabular-nums">
          {formatTime(displayMs)}
        </p>
        {PHASE_LABELS[phase] && (
          <p className="mt-2 text-gray-400">{PHASE_LABELS[phase]}</p>
        )}
      </div>

      {/* Recent solves */}
      {recentSolves.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Recent Solves</h2>
          <SolveHistory solves={recentSolves} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/features/solve/ScrambleDisplay.tsx src/features/solve/SolvePage.tsx
git commit -m "feat: color-coded scramble display with error recovery UI"
```

---

## Task 4: Verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 2: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: No errors

- [ ] **Step 3: Manual smoke test**

1. `npm run dev`
2. Open `/` — see "Connect Cube" button
3. Connect cube — scramble auto-appears with all moves in white, timer shows 0.00
4. Apply scramble moves — each turns green as completed
5. Make a wrong move — scramble replaced by red recovery sequence
6. Undo the wrong move — recovery clears, scramble returns at same position
7. Complete scramble — "Scramble verified" message, timer shows 0.00
8. Start solving — timer counts up
9. Solve the cube — timer stops, shows solve time
10. Next scramble auto-appears immediately — timer still shows previous solve time
11. Navigate to `/history` — all solves listed
