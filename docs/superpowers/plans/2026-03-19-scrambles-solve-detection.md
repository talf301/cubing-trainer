# Phase 2: Scrambles + Solve Detection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate scrambles, detect when the physical cube matches the scrambled state, time the solve from first post-scramble move to solved state, record solves with full move sequences to IndexedDB, and display solve history.

**Architecture:** A framework-agnostic `SolveSession` state machine in `src/core/` drives the scramble→solve lifecycle, consuming `CubeMoveEvent`s from the existing `CubeConnection` interface. A `SolveStore` wraps IndexedDB via `idb` for persistence. The Timer page (`/`) composes these with a React hook that bridges the state machine to UI rendering.

**Tech Stack:** cubing.js (scramble, kpuzzle, puzzles, alg), idb, React, TypeScript, Vitest

---

## File Structure

```
src/core/
  solve-session.ts              — SolveSession state machine (scramble verification, timing, solve detection)
  solve-session.test.ts         — Unit tests for SolveSession (in src/core/__tests__/)

src/lib/
  scramble.ts                   — Thin wrapper: generate scramble + compute expected state
  solve-store.ts                — IndexedDB persistence via idb (open DB, save/load solves)
  solve-store.test.ts           — Tests for solve store (in src/lib/__tests__/)
  db.ts                         — Shared DB instance + schema

src/features/solve/
  use-solve-session.ts          — React hook bridging SolveSession + CubeConnection to UI state
  SolvePage.tsx                 — Timer page: scramble display, timer, status, recent solves
  SolveHistory.tsx              — Solve history list component

src/app/
  routes.tsx                    — Update Timer route to use SolvePage
```

---

## Data Model

```typescript
// Stored in IndexedDB "solves" object store
interface StoredSolve {
  id: string;              // crypto.randomUUID()
  scramble: string;        // algorithm string, e.g. "R U R' U' F ..."
  moves: TimestampedMove[];// full move sequence with timestamps
  startTime: number;       // Date.now() at first solving move
  endTime: number;         // Date.now() when solved state detected
  duration: number;        // endTime - startTime in ms
  createdAt: number;       // Date.now() when record saved
}

interface TimestampedMove {
  move: string;            // move notation, e.g. "R", "U'", "F2"
  timestamp: number;       // ms since startTime (relative)
}
```

---

## Task 1: Scramble generation utility

**Files:**
- Create: `src/lib/scramble.ts`
- Create: `src/lib/__tests__/scramble.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/scramble.test.ts
import { describe, it, expect } from "vitest";
import { generateScramble } from "@/lib/scramble";

describe("generateScramble", () => {
  it("returns a scramble string and expected pattern", async () => {
    const result = await generateScramble();
    expect(typeof result.scramble).toBe("string");
    expect(result.scramble.length).toBeGreaterThan(0);
    expect(result.expectedState).toBeDefined();
  });

  it("expected state is not solved", async () => {
    const result = await generateScramble();
    expect(
      result.expectedState.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
    ).toBe(false);
  });

  it("expected state matches applying scramble to solved", async () => {
    const { cube3x3x3 } = await import("cubing/puzzles");
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();

    const result = await generateScramble();
    const manuallyScrambled = solved.applyAlg(result.scramble);
    expect(result.expectedState.isIdentical(manuallyScrambled)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/lib/__tests__/scramble.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/scramble.ts
import { randomScrambleForEvent } from "cubing/scramble";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern } from "cubing/kpuzzle";

export interface ScrambleResult {
  scramble: string;
  expectedState: KPattern;
}

export async function generateScramble(): Promise<ScrambleResult> {
  const [scrambleAlg, kpuzzle] = await Promise.all([
    randomScrambleForEvent("333"),
    cube3x3x3.kpuzzle(),
  ]);

  const scramble = scrambleAlg.toString();
  const solved = kpuzzle.defaultPattern();
  const expectedState = solved.applyAlg(scrambleAlg);

  return { scramble, expectedState };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/lib/__tests__/scramble.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/scramble.ts src/lib/__tests__/scramble.test.ts
git commit -m "feat: add scramble generation utility"
```

---

## Task 2: SolveSession state machine

**Files:**
- Create: `src/core/solve-session.ts`
- Create: `src/core/__tests__/solve-session.test.ts`

The state machine has these states:
- `idle` — nothing happening
- `scrambling` — scramble displayed, waiting for user to match it
- `ready` — cube matches scramble, waiting for first solve move
- `solving` — timer running, recording moves
- `solved` — cube reached solved state

- [ ] **Step 1: Write tests for state transitions**

```typescript
// src/core/__tests__/solve-session.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { SolveSession } from "@/core/solve-session";
import type { KPattern } from "cubing/kpuzzle";

async function setup() {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();
  return { kpuzzle, solved };
}

describe("SolveSession", () => {
  it("starts in idle phase", () => {
    const session = new SolveSession();
    expect(session.phase).toBe("idle");
  });

  it("transitions to scrambling when startScramble is called", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState);
    expect(session.phase).toBe("scrambling");
    expect(session.scramble).toBe("R U R' U'");
  });

  it("transitions to ready when cube state matches expected scramble", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState);
    session.onCubeState(expectedState);
    expect(session.phase).toBe("ready");
  });

  it("stays in scrambling when cube state does not match", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState);
    session.onCubeState(solved); // wrong state
    expect(session.phase).toBe("scrambling");
  });

  it("transitions to solving on first move after ready", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const expectedState = solved.applyAlg("R U R' U'");

    session.startScramble("R U R' U'", expectedState);
    session.onCubeState(expectedState);
    expect(session.phase).toBe("ready");

    const afterMove = expectedState.applyMove("U");
    session.onMove("U", 1000, afterMove);
    expect(session.phase).toBe("solving");
    expect(session.moves).toHaveLength(1);
    expect(session.moves[0].move).toBe("U");
  });

  it("transitions to solved when cube reaches solved state", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    // Use a short algorithm so we can undo it
    const expectedState = solved.applyMove("R");

    session.startScramble("R", expectedState);
    session.onCubeState(expectedState);

    // First move starts solving
    const afterRPrime = expectedState.applyMove("R'");
    session.onMove("R'", 1000, afterRPrime);
    expect(session.phase).toBe("solved");
  });

  it("records all moves with relative timestamps", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const scrambled = solved.applyAlg("R U");

    session.startScramble("R U", scrambled);
    session.onCubeState(scrambled);

    const s1 = scrambled.applyMove("U'");
    session.onMove("U'", 5000, s1);
    const s2 = s1.applyMove("R'");
    session.onMove("R'", 5500, s2);

    expect(session.phase).toBe("solved");
    expect(session.moves).toHaveLength(2);
    expect(session.moves[0].timestamp).toBe(0); // relative to start
    expect(session.moves[1].timestamp).toBe(500);
  });

  it("provides duration after solve completes", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const scrambled = solved.applyMove("R");

    session.startScramble("R", scrambled);
    session.onCubeState(scrambled);
    session.onMove("R'", 1000, solved);

    expect(session.duration).toBe(0); // single move, 0 relative time
  });

  it("reset returns to idle", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const scrambled = solved.applyMove("R");

    session.startScramble("R", scrambled);
    session.reset();
    expect(session.phase).toBe("idle");
  });

  it("emits phase change events", async () => {
    const session = new SolveSession();
    const { solved } = await setup();
    const scrambled = solved.applyMove("R");

    const phases: string[] = [];
    session.addPhaseListener((phase) => phases.push(phase));

    session.startScramble("R", scrambled);
    session.onCubeState(scrambled);
    session.onMove("R'", 1000, solved);

    expect(phases).toEqual(["scrambling", "ready", "solving", "solved"]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/core/__tests__/solve-session.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the SolveSession implementation**

```typescript
// src/core/solve-session.ts
import type { KPattern } from "cubing/kpuzzle";

export type SolvePhase = "idle" | "scrambling" | "ready" | "solving" | "solved";

export interface TimestampedMove {
  move: string;
  timestamp: number; // ms relative to solve start
}

export class SolveSession {
  private _phase: SolvePhase = "idle";
  private _scramble: string = "";
  private expectedState: KPattern | null = null;
  private _moves: TimestampedMove[] = [];
  private solveStartTime: number = 0;
  private solveEndTime: number = 0;
  private phaseListeners = new Set<(phase: SolvePhase) => void>();

  get phase(): SolvePhase {
    return this._phase;
  }

  get scramble(): string {
    return this._scramble;
  }

  get moves(): readonly TimestampedMove[] {
    return this._moves;
  }

  get duration(): number {
    if (this._phase !== "solved") return 0;
    return this.solveEndTime - this.solveStartTime;
  }

  get startTime(): number {
    return this.solveStartTime;
  }

  get endTime(): number {
    return this.solveEndTime;
  }

  startScramble(scramble: string, expectedState: KPattern): void {
    this._scramble = scramble;
    this.expectedState = expectedState;
    this._moves = [];
    this.solveStartTime = 0;
    this.solveEndTime = 0;
    this.setPhase("scrambling");
  }

  onCubeState(currentState: KPattern): void {
    if (this._phase !== "scrambling") return;
    if (!this.expectedState) return;

    if (currentState.isIdentical(this.expectedState)) {
      this.setPhase("ready");
    }
  }

  onMove(move: string, timestamp: number, stateAfterMove: KPattern): void {
    if (this._phase === "ready") {
      this.solveStartTime = timestamp;
      this.setPhase("solving");
    }

    if (this._phase !== "solving") return;

    this._moves.push({
      move,
      timestamp: timestamp - this.solveStartTime,
    });

    const isSolved = stateAfterMove.experimentalIsSolved({
      ignorePuzzleOrientation: true,
      ignoreCenterOrientation: true,
    });

    if (isSolved) {
      this.solveEndTime = timestamp;
      this.setPhase("solved");
    }
  }

  reset(): void {
    this._phase = "idle";
    this._scramble = "";
    this.expectedState = null;
    this._moves = [];
    this.solveStartTime = 0;
    this.solveEndTime = 0;
    // No event emitted for reset — consumers check phase directly
  }

  addPhaseListener(callback: (phase: SolvePhase) => void): void {
    this.phaseListeners.add(callback);
  }

  removePhaseListener(callback: (phase: SolvePhase) => void): void {
    this.phaseListeners.delete(callback);
  }

  private setPhase(phase: SolvePhase): void {
    this._phase = phase;
    for (const listener of this.phaseListeners) {
      listener(phase);
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/core/__tests__/solve-session.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/solve-session.ts src/core/__tests__/solve-session.test.ts
git commit -m "feat: add SolveSession state machine for scramble-to-solve lifecycle"
```

---

## Task 3: IndexedDB persistence layer

**Files:**
- Create: `src/lib/db.ts`
- Create: `src/lib/solve-store.ts`
- Create: `src/lib/__tests__/solve-store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/__tests__/solve-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import { SolveStore, type StoredSolve } from "@/lib/solve-store";
import { resetDB } from "@/lib/db";

function makeSolve(overrides: Partial<StoredSolve> = {}): StoredSolve {
  return {
    id: crypto.randomUUID(),
    scramble: "R U R' U'",
    moves: [
      { move: "U", timestamp: 0 },
      { move: "R", timestamp: 200 },
      { move: "U'", timestamp: 400 },
      { move: "R'", timestamp: 600 },
    ],
    startTime: 1000,
    endTime: 1600,
    duration: 600,
    createdAt: Date.now(),
    ...overrides,
  };
}

describe("SolveStore", () => {
  let store: SolveStore;

  beforeEach(() => {
    resetDB();
    store = new SolveStore();
  });

  it("saves and retrieves a solve", async () => {
    const solve = makeSolve();
    await store.save(solve);
    const all = await store.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].id).toBe(solve.id);
    expect(all[0].scramble).toBe("R U R' U'");
  });

  it("returns solves in reverse chronological order", async () => {
    const s1 = makeSolve({ createdAt: 1000 });
    const s2 = makeSolve({ createdAt: 2000 });
    const s3 = makeSolve({ createdAt: 3000 });
    await store.save(s1);
    await store.save(s2);
    await store.save(s3);

    const all = await store.getAll();
    expect(all[0].createdAt).toBe(3000);
    expect(all[2].createdAt).toBe(1000);
  });

  it("retrieves a solve by id", async () => {
    const solve = makeSolve();
    await store.save(solve);
    const retrieved = await store.getById(solve.id);
    expect(retrieved?.id).toBe(solve.id);
  });

  it("returns undefined for non-existent id", async () => {
    const result = await store.getById("nonexistent");
    expect(result).toBeUndefined();
  });
});
```

- [ ] **Step 2: Install fake-indexeddb for testing**

Run: `npm install -D fake-indexeddb`

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- src/lib/__tests__/solve-store.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write db.ts and solve-store.ts**

```typescript
// src/lib/db.ts
import { openDB, type IDBPDatabase } from "idb";

export interface PhasewiseDB {
  solves: {
    key: string;
    value: {
      id: string;
      scramble: string;
      moves: { move: string; timestamp: number }[];
      startTime: number;
      endTime: number;
      duration: number;
      createdAt: number;
    };
    indexes: { "by-created": number };
  };
}

let dbPromise: Promise<IDBPDatabase<PhasewiseDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<PhasewiseDB>> {
  if (!dbPromise) {
    dbPromise = openDB<PhasewiseDB>("phasewise", 1, {
      upgrade(db) {
        const solveStore = db.createObjectStore("solves", { keyPath: "id" });
        solveStore.createIndex("by-created", "createdAt");
      },
    });
  }
  return dbPromise;
}

/** Reset the cached DB promise — used in tests with fake-indexeddb */
export function resetDB(): void {
  dbPromise = null;
}
```

```typescript
// src/lib/solve-store.ts
import { getDB } from "./db";
import type { TimestampedMove } from "@/core/solve-session";

export interface StoredSolve {
  id: string;
  scramble: string;
  moves: TimestampedMove[];
  startTime: number;
  endTime: number;
  duration: number;
  createdAt: number;
}

export class SolveStore {
  async save(solve: StoredSolve): Promise<void> {
    const db = await getDB();
    await db.put("solves", solve);
  }

  async getAll(): Promise<StoredSolve[]> {
    const db = await getDB();
    const all = await db.getAllFromIndex("solves", "by-created");
    return all.reverse(); // newest first
  }

  async getById(id: string): Promise<StoredSolve | undefined> {
    const db = await getDB();
    return db.get("solves", id);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- src/lib/__tests__/solve-store.test.ts`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/db.ts src/lib/solve-store.ts src/lib/__tests__/solve-store.test.ts
git commit -m "feat: add IndexedDB persistence for solves via idb"
```

---

## Task 4: React hook bridging SolveSession to UI

**Files:**
- Create: `src/features/solve/use-solve-session.ts`

This hook owns the `SolveSession` instance, listens to the `CubeConnection` for moves, generates scrambles, saves completed solves, and exposes reactive state to the UI.

- [ ] **Step 1: Write the hook**

```typescript
// src/features/solve/use-solve-session.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { CubeConnection, CubeMoveEvent } from "@/core/cube-connection";
import { SolveSession, type SolvePhase } from "@/core/solve-session";
import { generateScramble } from "@/lib/scramble";
import { SolveStore, type StoredSolve } from "@/lib/solve-store";

const solveStore = new SolveStore();

export function useSolveSession(connection: CubeConnection) {
  const sessionRef = useRef(new SolveSession());
  const [phase, setPhase] = useState<SolvePhase>("idle");
  const [scramble, setScramble] = useState<string>("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recentSolves, setRecentSolves] = useState<StoredSolve[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solveStartWallRef = useRef(0);

  // Load recent solves on mount
  useEffect(() => {
    solveStore.getAll().then(setRecentSolves);
  }, []);

  // Listen to phase changes
  useEffect(() => {
    const session = sessionRef.current;
    const onPhase = (newPhase: SolvePhase) => {
      setPhase(newPhase);

      if (newPhase === "solving") {
        solveStartWallRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setElapsedMs(Date.now() - solveStartWallRef.current);
        }, 10);
      }

      if (newPhase === "solved") {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setElapsedMs(session.duration);

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
      }
    };

    session.addPhaseListener(onPhase);
    return () => {
      session.removePhaseListener(onPhase);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Listen to cube moves and feed them to the session
  useEffect(() => {
    const session = sessionRef.current;

    const onMove = (event: CubeMoveEvent) => {
      if (session.phase === "scrambling") {
        // Check if this move completes the scramble — but don't also start solving.
        // The NEXT move after scramble is verified starts the timer.
        session.onCubeState(event.state);
      } else if (session.phase === "ready" || session.phase === "solving") {
        session.onMove(event.move.toString(), event.timestamp, event.state);
      }
    };

    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection]);

  const startNewSolve = useCallback(async () => {
    const result = await generateScramble();
    setScramble(result.scramble);
    setElapsedMs(0);
    sessionRef.current.startScramble(result.scramble, result.expectedState);
  }, []);

  return {
    phase,
    scramble,
    elapsedMs,
    recentSolves,
    startNewSolve,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/solve/use-solve-session.ts
git commit -m "feat: add useSolveSession hook bridging state machine to React"
```

---

## Task 5: SolvePage UI

**Files:**
- Create: `src/features/solve/SolvePage.tsx`
- Create: `src/features/solve/SolveHistory.tsx`
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Write the SolveHistory component**

```typescript
// src/features/solve/SolveHistory.tsx
import type { StoredSolve } from "@/lib/solve-store";

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  }
  return seconds.toFixed(2);
}

interface SolveHistoryProps {
  solves: StoredSolve[];
}

export function SolveHistory({ solves }: SolveHistoryProps) {
  if (solves.length === 0) {
    return <p className="text-gray-500">No solves yet.</p>;
  }

  return (
    <div className="space-y-1">
      {solves.map((solve, i) => (
        <div
          key={solve.id}
          className="flex justify-between font-mono text-sm text-gray-300"
        >
          <span className="text-gray-500">{i + 1}.</span>
          <span>{formatTime(solve.duration)}</span>
          <span className="text-gray-600 text-xs truncate max-w-[200px]">
            {solve.scramble}
          </span>
        </div>
      ))}
    </div>
  );
}

export { formatTime };
```

- [ ] **Step 2: Write the SolvePage component**

```typescript
// src/features/solve/SolvePage.tsx
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "@/features/bluetooth/use-cube-connection";
import { useSolveSession } from "./use-solve-session";
import { SolveHistory, formatTime } from "./SolveHistory";

interface SolvePageProps {
  connection: CubeConnection;
}

const PHASE_LABELS: Record<string, string> = {
  idle: "Connect your cube and press Start",
  scrambling: "Apply the scramble to your cube",
  ready: "Scramble verified — start solving!",
  solving: "",
  solved: "Solved!",
};

export function SolvePage({ connection }: SolvePageProps) {
  const { status, connect } = useCubeConnection(connection);
  const { phase, scramble, elapsedMs, recentSolves, startNewSolve } =
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

      {/* Scramble display */}
      {scramble && phase !== "idle" && (
        <div className="text-center">
          <p className="font-mono text-xl tracking-wide">{scramble}</p>
        </div>
      )}

      {/* Timer */}
      <div className="text-center">
        <p className="font-mono text-6xl font-bold tabular-nums">
          {formatTime(elapsedMs)}
        </p>
        <p className="mt-2 text-gray-400">{PHASE_LABELS[phase]}</p>
      </div>

      {/* Start / Next button */}
      {isConnected && (phase === "idle" || phase === "solved") && (
        <div className="text-center">
          <button
            onClick={startNewSolve}
            className="rounded bg-green-600 px-6 py-3 text-lg font-medium hover:bg-green-500"
          >
            {phase === "idle" ? "Start" : "Next Solve"}
          </button>
        </div>
      )}

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

- [ ] **Step 3: Update routes to use SolvePage**

Replace the `Timer` stub in `src/app/routes.tsx`:

```typescript
// src/app/routes.tsx
import { useState } from "react";
import { BluetoothDebug } from "@/features/bluetooth/BluetoothDebug";
import { GanBluetoothConnection } from "@/features/bluetooth/gan-bluetooth-connection";
import { SolvePage } from "@/features/solve/SolvePage";

// Shared connection instance — both Timer and Debug use the same cube
const sharedConnection = new GanBluetoothConnection();

function Timer() {
  return <SolvePage connection={sharedConnection} />;
}

function History() {
  return <h1 className="text-2xl font-bold">History</h1>;
}

function Training() {
  return <h1 className="text-2xl font-bold">Training</h1>;
}

function Settings() {
  return <h1 className="text-2xl font-bold">Settings</h1>;
}

function Debug() {
  return <BluetoothDebug connection={sharedConnection} />;
}

export { Timer, History, Training, Settings, Debug };
```

- [ ] **Step 4: Run typecheck and build**

Run: `npm run typecheck && npm run build`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/features/solve/SolvePage.tsx src/features/solve/SolveHistory.tsx src/app/routes.tsx
git commit -m "feat: add solve page with scramble display, timer, and solve history"
```

---

## Task 6: Full history page

**Files:**
- Modify: `src/app/routes.tsx`

- [ ] **Step 1: Update the History route to show all stored solves**

```typescript
// In src/app/routes.tsx, replace the History stub:
import { useState, useEffect } from "react";
import { SolveStore, type StoredSolve } from "@/lib/solve-store";
import { SolveHistory as SolveHistoryList } from "@/features/solve/SolveHistory";

const solveStore = new SolveStore();

function History() {
  const [solves, setSolves] = useState<StoredSolve[]>([]);

  useEffect(() => {
    solveStore.getAll().then(setSolves);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Solve History</h1>
      <SolveHistoryList solves={solves} />
    </div>
  );
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/routes.tsx
git commit -m "feat: wire up History page to display all stored solves"
```

---

## Task 7: End-to-end verification and cleanup

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests pass

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Clean build, no warnings

- [ ] **Step 4: Manual smoke test**

1. `npm run dev`
2. Open `/` — see "Connect Cube" button
3. Connect GAN cube
4. Press "Start" — see scramble
5. Apply scramble to physical cube — see "Scramble verified" message
6. Start solving — timer starts
7. Solve the cube — timer stops, solve appears in list
8. Press "Next Solve" — new scramble generated
9. Navigate to `/history` — see all solves
10. Refresh the page — solves persist

- [ ] **Step 5: Final commit if any cleanup needed**
