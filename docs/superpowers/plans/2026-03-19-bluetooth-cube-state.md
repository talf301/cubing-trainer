# Phase 1: Bluetooth + Cube State — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect to a smart cube via Web Bluetooth, receive moves, maintain accurate cube state, and display it in a debug UI.

**Architecture:** A `CubeConnection` interface in `src/core/` defines the contract (framework-agnostic). A Web Bluetooth implementation in `src/features/bluetooth/` wraps cubing.js's `connectSmartPuzzle()` and `KPuzzle`. A React hook bridges to the UI. The debug view shows connection status, move log, SVG cube state, and a reset button.

**Tech Stack:** cubing.js (bluetooth, kpuzzle, alg, twisty, puzzles), React, TypeScript, Vitest

---

## File Structure

```
src/core/
  cube-connection.ts          — CubeConnection interface + types (no factory)

src/core/__tests__/
  cube-state.test.ts          — Tests for KPuzzle state management logic

src/features/bluetooth/
  web-bluetooth-connection.ts — CubeConnection impl wrapping cubing.js
  use-cube-connection.ts      — React hook bridging CubeConnection to components
  CubeSvgViewer.tsx           — React wrapper for cubing.js TwistyAnimatedSVG
  BluetoothDebug.tsx          — Debug UI page component

src/features/bluetooth/__tests__/
  use-cube-connection.test.ts — Tests for the React hook with a mock connection
  BluetoothDebug.test.ts      — Tests for the debug UI rendering
```

---

### Task 1: CubeConnection Interface + Types

**Files:**
- Create: `src/core/cube-connection.ts`

This is the framework-agnostic contract. No implementation yet — just types. Lives in `src/core/` per the architectural invariant.

- [ ] **Step 1: Create the interface file**

```typescript
// src/core/cube-connection.ts
import type { KPattern } from "cubing/kpuzzle";
import type { Move } from "cubing/alg";

export interface CubeMoveEvent {
  move: Move;
  timestamp: number;
  state: KPattern;
}

export type ConnectionStatus = "disconnected" | "connecting" | "connected";

export interface CubeConnection {
  connect(): Promise<void>;
  disconnect(): void;
  resetState(): void;

  readonly status: ConnectionStatus;
  readonly state: KPattern | null;

  addMoveListener(callback: (event: CubeMoveEvent) => void): void;
  removeMoveListener(callback: (event: CubeMoveEvent) => void): void;

  addStatusListener(callback: (status: ConnectionStatus) => void): void;
  removeStatusListener(callback: (status: ConnectionStatus) => void): void;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/core/cube-connection.ts
git commit -m "feat: add CubeConnection interface and types"
```

---

### Task 2: Cube State Management Tests

**Files:**
- Create: `src/core/__tests__/cube-state.test.ts`

Test that KPuzzle state management works correctly — applying moves, checking solved state, resetting. These are pure logic tests against cubing.js's `KPuzzle`, verifying our assumptions about the API before we build on it.

- [ ] **Step 1: Write tests for KPuzzle state management**

```typescript
// src/core/__tests__/cube-state.test.ts
import { describe, it, expect } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";

describe("cube state management", () => {
  it("default pattern represents solved state", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    expect(
      solved.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
    ).toBe(true);
  });

  it("applying a move changes state from solved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const afterR = solved.applyMove("R");
    expect(afterR.isIdentical(solved)).toBe(false);
    expect(
      afterR.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
    ).toBe(false);
  });

  it("applying a move and its inverse returns to solved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const afterR = solved.applyMove("R");
    const afterRR = afterR.applyMove("R'");
    expect(afterRR.isIdentical(solved)).toBe(true);
  });

  it("applying a known algorithm and its inverse returns to solved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const afterAlg = solved.applyAlg("R U R' U'");
    expect(afterAlg.isIdentical(solved)).toBe(false);
    const restored = afterAlg.applyAlg("U R U' R'");
    expect(restored.isIdentical(solved)).toBe(true);
  });

  it("state is immutable — applying a move returns a new pattern", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const solved = kpuzzle.defaultPattern();
    const afterR = solved.applyMove("R");
    // Original should still be solved
    expect(
      solved.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
    ).toBe(true);
    expect(afterR.isIdentical(solved)).toBe(false);
  });

  it("reset to solved is just defaultPattern()", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const scrambled = kpuzzle.defaultPattern().applyAlg("R U F D L B");
    const reset = kpuzzle.defaultPattern();
    expect(
      reset.experimentalIsSolved({
        ignorePuzzleOrientation: true,
        ignoreCenterOrientation: true,
      }),
    ).toBe(true);
    expect(reset.isIdentical(scrambled)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npm run test -- src/core/__tests__/cube-state.test.ts`
Expected: All 6 tests PASS (these test cubing.js's own API — they should work)

- [ ] **Step 3: Commit**

```bash
git add src/core/__tests__/cube-state.test.ts
git commit -m "test: verify KPuzzle state management assumptions"
```

---

### Task 3: Web Bluetooth Connection Implementation

**Files:**
- Create: `src/features/bluetooth/web-bluetooth-connection.ts`
This implements `CubeConnection` by wrapping cubing.js's `connectSmartPuzzle()` and managing state via `KPuzzle`.

- [ ] **Step 1: Implement WebBluetoothCubeConnection**

```typescript
// src/features/bluetooth/web-bluetooth-connection.ts
import { connectSmartPuzzle } from "cubing/bluetooth";
import type { BluetoothPuzzle, MoveEvent as BtMoveEvent } from "cubing/bluetooth";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPuzzle, KPattern } from "cubing/kpuzzle";
import { Move } from "cubing/alg";
import type {
  CubeConnection,
  ConnectionStatus,
  CubeMoveEvent,
} from "@/core/cube-connection";

export class WebBluetoothCubeConnection implements CubeConnection {
  private puzzle: BluetoothPuzzle | null = null;
  private kpuzzle: KPuzzle | null = null;
  private currentState: KPattern | null = null;
  private currentStatus: ConnectionStatus = "disconnected";

  private moveListeners = new Set<(event: CubeMoveEvent) => void>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  get status(): ConnectionStatus {
    return this.currentStatus;
  }

  get state(): KPattern | null {
    return this.currentState;
  }

  async connect(): Promise<void> {
    if (this.currentStatus === "connecting") return;

    this.setStatus("connecting");

    try {
      this.kpuzzle = await cube3x3x3.kpuzzle();
      this.currentState = this.kpuzzle.defaultPattern();

      this.puzzle = await connectSmartPuzzle();

      this.puzzle.addAlgLeafListener((event: BtMoveEvent) => {
        this.handleMove(event);
      });

      // Detect disconnection. Try the BluetoothPuzzle's EventTarget first;
      // if that doesn't fire, the GATT server disconnected event is the fallback.
      // cubing.js BluetoothPuzzle extends EventTarget but may not dispatch
      // "disconnected" — so we also try the underlying device if available.
      this.puzzle.addEventListener("disconnected", () => {
        this.setStatus("disconnected");
        this.puzzle = null;
      });

      this.setStatus("connected");
    } catch (error) {
      this.setStatus("disconnected");
      throw error;
    }
  }

  disconnect(): void {
    if (this.puzzle) {
      this.puzzle.disconnect();
      this.puzzle = null;
    }
    this.setStatus("disconnected");
  }

  resetState(): void {
    if (this.kpuzzle) {
      this.currentState = this.kpuzzle.defaultPattern();
    }
  }

  addMoveListener(callback: (event: CubeMoveEvent) => void): void {
    this.moveListeners.add(callback);
  }

  removeMoveListener(callback: (event: CubeMoveEvent) => void): void {
    this.moveListeners.delete(callback);
  }

  addStatusListener(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.add(callback);
  }

  removeStatusListener(callback: (status: ConnectionStatus) => void): void {
    this.statusListeners.delete(callback);
  }

  private handleMove(event: BtMoveEvent): void {
    if (!this.currentState) return;

    const move = event.latestAlgLeaf;
    if (!(move instanceof Move)) return;

    this.currentState = this.currentState.applyMove(move);

    const moveEvent: CubeMoveEvent = {
      move,
      timestamp: event.timeStamp,
      state: this.currentState,
    };

    for (const listener of this.moveListeners) {
      listener(moveEvent);
    }
  }

  private setStatus(status: ConnectionStatus): void {
    this.currentStatus = status;
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/features/bluetooth/web-bluetooth-connection.ts
git commit -m "feat: implement WebBluetoothCubeConnection wrapping cubing.js"
```

---

### Task 4: React Hook

**Files:**
- Create: `src/features/bluetooth/use-cube-connection.ts`
- Create: `src/features/bluetooth/__tests__/use-cube-connection.test.ts`

A hook that bridges `CubeConnection` to React state. Takes a `CubeConnection` instance as a parameter (not created internally) so it's testable with a mock.

- [ ] **Step 1: Write tests for the hook**

```typescript
// src/features/bluetooth/__tests__/use-cube-connection.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCubeConnection } from "../use-cube-connection";
import type {
  CubeConnection,
  ConnectionStatus,
  CubeMoveEvent,
} from "@/core/cube-connection";

function createMockConnection(): CubeConnection & {
  simulateMove: (event: CubeMoveEvent) => void;
  simulateStatus: (status: ConnectionStatus) => void;
} {
  const moveListeners = new Set<(event: CubeMoveEvent) => void>();
  const statusListeners = new Set<(status: ConnectionStatus) => void>();

  return {
    status: "disconnected" as ConnectionStatus,
    state: null,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    resetState: vi.fn(),
    addMoveListener: (cb) => moveListeners.add(cb),
    removeMoveListener: (cb) => moveListeners.delete(cb),
    addStatusListener: (cb) => statusListeners.add(cb),
    removeStatusListener: (cb) => statusListeners.delete(cb),
    simulateMove: (event) => {
      for (const cb of moveListeners) cb(event);
    },
    simulateStatus: (status) => {
      for (const cb of statusListeners) cb(status);
    },
  };
}

describe("useCubeConnection", () => {
  let mockConnection: ReturnType<typeof createMockConnection>;

  beforeEach(() => {
    mockConnection = createMockConnection();
  });

  it("starts with disconnected status and empty moves", () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));
    expect(result.current.status).toBe("disconnected");
    expect(result.current.moves).toEqual([]);
    expect(result.current.state).toBeNull();
  });

  it("calls connect on the connection", async () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));
    await act(async () => {
      await result.current.connect();
    });
    expect(mockConnection.connect).toHaveBeenCalled();
  });

  it("updates status when connection status changes", () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));
    act(() => {
      mockConnection.simulateStatus("connected");
    });
    expect(result.current.status).toBe("connected");
  });

  it("accumulates moves when move events fire", async () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));

    const fakeMoveEvent = {
      move: { toString: () => "R" },
      timestamp: 1000,
      state: {},
    } as unknown as CubeMoveEvent;

    act(() => {
      mockConnection.simulateMove(fakeMoveEvent);
    });

    expect(result.current.moves).toHaveLength(1);
    expect(result.current.moves[0]).toBe(fakeMoveEvent);
  });

  it("calls disconnect on the connection", () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));
    act(() => {
      result.current.disconnect();
    });
    expect(mockConnection.disconnect).toHaveBeenCalled();
  });

  it("calls resetState and clears moves", () => {
    const { result } = renderHook(() => useCubeConnection(mockConnection));

    const fakeMoveEvent = {
      move: { toString: () => "R" },
      timestamp: 1000,
      state: {},
    } as unknown as CubeMoveEvent;

    act(() => {
      mockConnection.simulateMove(fakeMoveEvent);
    });
    expect(result.current.moves).toHaveLength(1);

    act(() => {
      result.current.resetState();
    });
    expect(mockConnection.resetState).toHaveBeenCalled();
    expect(result.current.moves).toEqual([]);
  });

  it("cleans up listeners on unmount", () => {
    const { unmount } = renderHook(() => useCubeConnection(mockConnection));
    unmount();
    // Verify no errors on simulating events after unmount
    mockConnection.simulateStatus("connected");
    mockConnection.simulateMove({
      move: { toString: () => "R" },
      timestamp: 1000,
      state: {},
    } as unknown as CubeMoveEvent);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/features/bluetooth/__tests__/use-cube-connection.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the hook**

```typescript
// src/features/bluetooth/use-cube-connection.ts
import { useState, useEffect, useCallback } from "react";
import type {
  CubeConnection,
  ConnectionStatus,
  CubeMoveEvent,
} from "@/core/cube-connection";
import type { KPattern } from "cubing/kpuzzle";

// Enough moves for a debug view without unbounded growth
const MAX_MOVE_HISTORY = 50;

export function useCubeConnection(connection: CubeConnection) {
  const [status, setStatus] = useState<ConnectionStatus>(connection.status);
  const [state, setState] = useState<KPattern | null>(connection.state);
  const [moves, setMoves] = useState<CubeMoveEvent[]>([]);

  useEffect(() => {
    const onStatus = (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
    };

    const onMove = (event: CubeMoveEvent) => {
      setState(event.state);
      setMoves((prev) => [...prev, event].slice(-MAX_MOVE_HISTORY));
    };

    connection.addStatusListener(onStatus);
    connection.addMoveListener(onMove);

    return () => {
      connection.removeStatusListener(onStatus);
      connection.removeMoveListener(onMove);
    };
  }, [connection]);

  const connect = useCallback(async () => {
    await connection.connect();
  }, [connection]);

  const disconnect = useCallback(() => {
    connection.disconnect();
  }, [connection]);

  const resetState = useCallback(() => {
    connection.resetState();
    setState(connection.state);
    setMoves([]);
  }, [connection]);

  return { status, state, moves, connect, disconnect, resetState };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/features/bluetooth/__tests__/use-cube-connection.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/bluetooth/use-cube-connection.ts src/features/bluetooth/__tests__/use-cube-connection.test.ts
git commit -m "feat: add useCubeConnection React hook with tests"
```

---

### Task 5: SVG Cube Viewer Component

**Files:**
- Create: `src/features/bluetooth/CubeSvgViewer.tsx`

Wraps cubing.js's `TwistyAnimatedSVG` in a React component. Since it manages a DOM element directly, we use a ref and imperative updates.

- [ ] **Step 1: Implement CubeSvgViewer**

```typescript
// src/features/bluetooth/CubeSvgViewer.tsx
import { useRef, useEffect, useState } from "react";
import { cube3x3x3 } from "cubing/puzzles";
import type { KPattern } from "cubing/kpuzzle";

interface CubeSvgViewerProps {
  pattern: KPattern | null;
}

// cubing.js exports TwistyAnimatedSVG as ExperimentalSVGAnimator.
// Constructor: new ExperimentalSVGAnimator(kpuzzle, svgSource)
// Methods: .draw(pattern), .drawPattern(pattern)
// Property: .wrapperElement (HTMLElement to mount in DOM)

type SvgAnimator = {
  draw(pattern: KPattern): void;
  wrapperElement: HTMLElement;
};

export function CubeSvgViewer({ pattern }: CubeSvgViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const animatorRef = useRef<SvgAnimator | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const kpuzzle = await cube3x3x3.kpuzzle();
      const svgSource = await cube3x3x3.svg();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { ExperimentalSVGAnimator } = await import("cubing/twisty") as any;

      if (cancelled || !containerRef.current) return;

      const animator = new ExperimentalSVGAnimator(kpuzzle, svgSource) as SvgAnimator;
      animatorRef.current = animator;
      containerRef.current.appendChild(animator.wrapperElement);
      animator.draw(pattern ?? kpuzzle.defaultPattern());
      setLoading(false);
    }

    init();

    return () => {
      cancelled = true;
      if (containerRef.current) {
        containerRef.current.innerHTML = "";
      }
      animatorRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (pattern && animatorRef.current) {
      animatorRef.current.draw(pattern);
    }
  }, [pattern]);

  return (
    <div ref={containerRef} className="inline-block">
      {loading && (
        <div className="text-gray-500 text-sm">Loading cube view...</div>
      )}
    </div>
  );
}
```

**Implementation note:** `ExperimentalSVGAnimator` is the exported name for `TwistyAnimatedSVG` in cubing.js. If this export is not available or has changed, fall back to using the `<twisty-player>` custom element with `visualization="2D"` — cubing.js registers it as a web component. Verify the export exists at implementation time with: `grep "ExperimentalSVGAnimator" node_modules/cubing/dist/lib/cubing/twisty/index.d.ts`.

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (or fixable type issues from the cubing.js import — adjust as needed)

- [ ] **Step 3: Commit**

```bash
git add src/features/bluetooth/CubeSvgViewer.tsx
git commit -m "feat: add CubeSvgViewer component wrapping cubing.js SVG"
```

---

### Task 6: Debug UI Page

**Files:**
- Create: `src/features/bluetooth/BluetoothDebug.tsx`
- Create: `src/features/bluetooth/__tests__/BluetoothDebug.test.tsx`
- Modify: `src/app/routes.tsx` — add debug route
- Modify: `src/app/Layout.tsx` — add debug nav link

The debug page wires everything together: connect/disconnect/reset buttons, status indicator, move log, and SVG cube viewer.

- [ ] **Step 1: Write tests for the debug UI**

```typescript
// src/features/bluetooth/__tests__/BluetoothDebug.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BluetoothDebug } from "../BluetoothDebug";
import type {
  CubeConnection,
  ConnectionStatus,
} from "@/core/cube-connection";

// Mock CubeSvgViewer to avoid cubing.js async loading + three.js in jsdom
vi.mock("../CubeSvgViewer", () => ({
  CubeSvgViewer: () => <div data-testid="cube-svg-mock" />,
}));

function createMockConnection(
  overrides: Partial<CubeConnection> = {},
): CubeConnection {
  return {
    status: "disconnected" as ConnectionStatus,
    state: null,
    connect: vi.fn(async () => {}),
    disconnect: vi.fn(),
    resetState: vi.fn(),
    addMoveListener: vi.fn(),
    removeMoveListener: vi.fn(),
    addStatusListener: vi.fn(),
    removeStatusListener: vi.fn(),
    ...overrides,
  };
}

describe("BluetoothDebug", () => {
  it("renders connect button when disconnected", () => {
    const conn = createMockConnection();
    render(<BluetoothDebug connection={conn} />);
    expect(
      screen.getByRole("button", { name: /connect/i }),
    ).toBeInTheDocument();
  });

  it("shows disconnected status", () => {
    const conn = createMockConnection();
    render(<BluetoothDebug connection={conn} />);
    expect(screen.getByText(/disconnected/i)).toBeInTheDocument();
  });

  it("calls connect when connect button is clicked", async () => {
    const conn = createMockConnection();
    render(<BluetoothDebug connection={conn} />);
    await userEvent.click(screen.getByRole("button", { name: /connect/i }));
    expect(conn.connect).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/features/bluetooth/__tests__/BluetoothDebug.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement BluetoothDebug component**

```typescript
// src/features/bluetooth/BluetoothDebug.tsx
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "./use-cube-connection";
import { CubeSvgViewer } from "./CubeSvgViewer";

interface BluetoothDebugProps {
  connection: CubeConnection;
}

const STATUS_COLORS: Record<string, string> = {
  disconnected: "text-red-400",
  connecting: "text-yellow-400",
  connected: "text-green-400",
};

export function BluetoothDebug({ connection }: BluetoothDebugProps) {
  const { status, state, moves, connect, disconnect, resetState } =
    useCubeConnection(connection);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bluetooth Debug</h1>

      {/* Connection status */}
      <div className="flex items-center gap-4">
        <span className={`font-mono ${STATUS_COLORS[status]}`}>{status}</span>
        {status === "disconnected" && (
          <button
            onClick={connect}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
          >
            Connect
          </button>
        )}
        {status === "connected" && (
          <>
            <button
              onClick={disconnect}
              className="rounded bg-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-500"
            >
              Disconnect
            </button>
            <button
              onClick={resetState}
              className="rounded bg-yellow-600 px-4 py-2 text-sm font-medium hover:bg-yellow-500"
            >
              Reset State
            </button>
          </>
        )}
      </div>

      {/* Cube state visualization */}
      {status === "connected" && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Cube State</h2>
          <CubeSvgViewer pattern={state} />
        </div>
      )}

      {/* Move log */}
      {moves.length > 0 && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">
            Recent Moves ({moves.length})
          </h2>
          <div className="font-mono text-sm text-gray-300">
            {moves.map((m, i) => (
              <span key={i} className="mr-2">
                {m.move.toString()}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/features/bluetooth/__tests__/BluetoothDebug.test.tsx`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/bluetooth/BluetoothDebug.tsx src/features/bluetooth/__tests__/BluetoothDebug.test.tsx
git commit -m "feat: add BluetoothDebug component with tests"
```

---

### Task 7: Wire Debug Page into App Routes

**Files:**
- Modify: `src/app/routes.tsx` — add BluetoothDebug page
- Modify: `src/app/Layout.tsx` — add nav link
- Modify: `src/app/App.tsx` — add route

This creates a `/debug` route that instantiates a `WebBluetoothCubeConnection` and renders the debug UI.

- [ ] **Step 1: Update routes.tsx — add Debug page and export**

Replace `src/app/routes.tsx` with:

```typescript
import { useState } from "react";
import { BluetoothDebug } from "@/features/bluetooth/BluetoothDebug";
import { WebBluetoothCubeConnection } from "@/features/bluetooth/web-bluetooth-connection";

function Timer() {
  return <h1 className="text-2xl font-bold">Timer</h1>;
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
  const [connection] = useState(() => new WebBluetoothCubeConnection());
  return <BluetoothDebug connection={connection} />;
}

export { Timer, History, Training, Settings, Debug };
```

- [ ] **Step 2: Update App.tsx — add Debug route and import**

Replace `src/app/App.tsx` with:

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./Layout";
import { Timer, History, Training, Settings, Debug } from "./routes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Timer />} />
          <Route path="/history" element={<History />} />
          <Route path="/training" element={<Training />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/debug" element={<Debug />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 3: Update Layout.tsx — add Debug nav link**

Add to the `navItems` array in `src/app/Layout.tsx`:

```typescript
const navItems = [
  { to: "/", label: "Timer" },
  { to: "/history", label: "History" },
  { to: "/training", label: "Training" },
  { to: "/settings", label: "Settings" },
  { to: "/debug", label: "Debug" },
];
```

- [ ] **Step 4: Verify typecheck and build pass**

Run: `npm run typecheck && npm run build`
Expected: Both PASS

- [ ] **Step 5: Run all tests**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/routes.tsx src/app/Layout.tsx src/app/App.tsx
git commit -m "feat: wire BluetoothDebug into app routes at /debug"
```

---

### Task 8: Manual Smoke Test with Real Cube

This task is manual — verify the full flow works with an actual GAN 356i Carry E.

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Navigate to /debug in Chrome**

- [ ] **Step 3: Click Connect, select the cube from the Bluetooth picker**

- [ ] **Step 4: Make moves on the cube — verify:**
- Status shows "connected"
- Moves appear in the move log
- SVG cube state updates to reflect moves

- [ ] **Step 5: Click Reset State — verify SVG shows solved**

- [ ] **Step 6: Click Disconnect — verify status shows "disconnected"**

- [ ] **Step 7: Click Connect again — verify reconnection works without page reload**

- [ ] **Step 8: If any issues found, fix and re-test. Then final commit.**

```bash
git commit -m "fix: adjustments from manual smoke test" # only if changes needed
```

---

## Notes for Implementer

1. **`ExperimentalSVGAnimator` export.** Verify it exists: `grep "ExperimentalSVGAnimator" node_modules/cubing/dist/lib/cubing/twisty/index.d.ts`. If not found, fall back to `<twisty-player visualization="2D">` web component.

2. **Disconnect detection.** The plan uses `addEventListener("disconnected", ...)` on `BluetoothPuzzle` (extends `EventTarget`). If this doesn't fire, fall back to listening on the underlying GATT server: access the `BluetoothDevice` from the puzzle and listen for `gattserverdisconnected`. The implementer should test this with the actual cube and adjust.

3. **`@/` path alias.** Already configured in `vite.config.ts`. Check that `tsconfig.json` also has `paths: { "@/*": ["./src/*"] }` — if not, add it so both Vite and TypeScript resolve the alias.

4. **`resetState()` behavior.** This method silently resets internal state without notifying listeners. The React hook handles this by manually reading `connection.state` after calling `resetState()`. This is intentional — a state notification is unnecessary since the hook knows it just triggered the reset.

5. **cubing.js naming collision.** `cubing/bluetooth` exports its own `MoveEvent` type. Our interface is named `CubeMoveEvent` to avoid the collision. The bluetooth implementation imports cubing's type as `BtMoveEvent`.
