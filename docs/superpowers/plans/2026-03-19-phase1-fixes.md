# Phase 1 Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix CubeViewer rendering (switch to TwistyPlayer), add MAC auto-detection with prompt fallback, and amend ADR-001 to reflect actual bluetooth library usage.

**Architecture:** Three independent changes. CubeViewer is rewritten to wrap `<twisty-player>` web component instead of `ExperimentalSVGAnimator`. MAC address provider uses `isFallbackCall` to try auto-detection first. ADR-001 gets an amendment section.

**Tech Stack:** cubing.js (TwistyPlayer web component, KPuzzle), gan-web-bluetooth, React, TypeScript, Vitest

---

## File Structure

```
src/features/bluetooth/
  CubeViewer.tsx               — NEW: replaces CubeSvgViewer.tsx, wraps <twisty-player>
  CubeSvgViewer.tsx            — DELETE
  BluetoothDebug.tsx           — MODIFY: use CubeViewer, add resetCount
  gan-bluetooth-connection.ts  — MODIFY: update MacAddressProvider callback
  __tests__/
    BluetoothDebug.test.tsx    — MODIFY: update mock path and component name

docs/decisions/
  ADR-001-cubing-js-bluetooth.md — MODIFY: amend status and add amendment section
```

---

### Task 1: CubeViewer Component

**Files:**
- Create: `src/features/bluetooth/CubeViewer.tsx`

- [ ] **Step 1: Create CubeViewer.tsx**

```typescript
// src/features/bluetooth/CubeViewer.tsx
import { useRef, useEffect } from "react";
import { TwistyPlayer } from "cubing/twisty";
import type { CubeMoveEvent } from "@/core/cube-connection";

interface CubeViewerProps {
  moves: CubeMoveEvent[];
  instanceKey: number;
}

export function CubeViewer({ moves, instanceKey }: CubeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);
  const fedCountRef = useRef(0);

  // Create/recreate player when instanceKey changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "2D",
      controlPanel: "none",
      backView: "none",
    });

    playerRef.current = player;
    fedCountRef.current = 0;
    container.appendChild(player);

    return () => {
      playerRef.current = null;
      if (player.parentNode) {
        player.parentNode.removeChild(player);
      }
    };
  }, [instanceKey]);

  // Feed new moves to the player
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const newMoves = moves.slice(fedCountRef.current);
    for (const moveEvent of newMoves) {
      player.experimentalAddMove(moveEvent.move);
    }
    if (newMoves.length > 0) {
      player.jumpToEnd();
    }
    fedCountRef.current = moves.length;
  }, [moves]);

  return <div ref={containerRef} className="inline-block" />;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (CubeSvgViewer.tsx still exists — it will be removed in Task 2)

- [ ] **Step 3: Commit**

```bash
git add src/features/bluetooth/CubeViewer.tsx
git commit -m "feat: add CubeViewer component wrapping TwistyPlayer

TwistyPlayer is cubing.js's supported rendering API and manages its
own DOM lifecycle, avoiding React StrictMode conflicts."
```

---

### Task 2: Update BluetoothDebug to Use CubeViewer

**Files:**
- Modify: `src/features/bluetooth/BluetoothDebug.tsx`
- Delete: `src/features/bluetooth/CubeSvgViewer.tsx`

- [ ] **Step 1: Update BluetoothDebug.tsx**

Replace the import and usage:

```typescript
// src/features/bluetooth/BluetoothDebug.tsx
import { useState } from "react";
import type { CubeConnection } from "@/core/cube-connection";
import { useCubeConnection } from "./use-cube-connection";
import { CubeViewer } from "./CubeViewer";

interface BluetoothDebugProps {
  connection: CubeConnection;
}

const STATUS_COLORS: Record<string, string> = {
  disconnected: "text-red-400",
  connecting: "text-yellow-400",
  connected: "text-green-400",
};

export function BluetoothDebug({ connection }: BluetoothDebugProps) {
  const { status, moves, error, connect, disconnect, resetState } =
    useCubeConnection(connection);
  const [resetCount, setResetCount] = useState(0);

  const handleReset = () => {
    resetState();
    setResetCount((c) => c + 1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Bluetooth Debug</h1>

      {/* Connection status */}
      <div className="flex items-center gap-4">
        <span className={`font-mono ${STATUS_COLORS[status]}`}>{status}</span>
        {(status === "disconnected" || status === "connecting") && (
          <button
            onClick={connect}
            disabled={status === "connecting"}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-50"
          >
            {status === "connecting" ? "Connecting..." : "Connect"}
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
              onClick={handleReset}
              className="rounded bg-yellow-600 px-4 py-2 text-sm font-medium hover:bg-yellow-500"
            >
              Reset State
            </button>
          </>
        )}
      </div>

      {/* Error display */}
      {error && (
        <div className="rounded bg-red-900/50 px-4 py-2 text-sm text-red-300">
          Error: {error}
        </div>
      )}

      {/* Cube state visualization */}
      {status === "connected" && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Cube State</h2>
          <CubeViewer moves={moves} instanceKey={resetCount} />
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

- [ ] **Step 2: Update BluetoothDebug.test.tsx**

Change the mock from `CubeSvgViewer` to `CubeViewer`:

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

// Mock CubeViewer to avoid cubing.js TwistyPlayer in jsdom
vi.mock("../CubeViewer", () => ({
  CubeViewer: () => <div data-testid="cube-viewer-mock" />,
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

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Delete CubeSvgViewer.tsx**

```bash
rm src/features/bluetooth/CubeSvgViewer.tsx
```

- [ ] **Step 6: Commit**

```bash
git add src/features/bluetooth/BluetoothDebug.tsx src/features/bluetooth/__tests__/BluetoothDebug.test.tsx
git rm src/features/bluetooth/CubeSvgViewer.tsx
git commit -m "feat: wire CubeViewer into BluetoothDebug, remove CubeSvgViewer

Switch BluetoothDebug from pattern-based CubeSvgViewer to move-based
CubeViewer with TwistyPlayer. Add resetCount for player recreation."
```

---

### Task 3: MAC Address Auto-Detection with Fallback

**Files:**
- Modify: `src/features/bluetooth/gan-bluetooth-connection.ts:40-49`

- [ ] **Step 1: Update the MacAddressProvider callback**

Replace lines 40–49 of `gan-bluetooth-connection.ts` (the `connectGanCube` call) with:

```typescript
      this.conn = await connectGanCube(async (_device, isFallbackCall) => {
        if (!isFallbackCall) {
          // Let the library try watchAdvertisements() for automatic MAC detection
          return null;
        }
        // Auto-detection failed — prompt the user as a fallback
        const mac = prompt(
          "Automatic MAC detection unavailable.\n" +
            "Enter cube MAC address (from chrome://bluetooth-internals):\n" +
            "Format: XX:XX:XX:XX:XX:XX",
        );
        return mac;
      });
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run tests**

Run: `npm run test`
Expected: All tests PASS (this code isn't unit-tested — it requires real Bluetooth)

- [ ] **Step 4: Commit**

```bash
git add src/features/bluetooth/gan-bluetooth-connection.ts
git commit -m "fix: try automatic MAC detection before prompting user

Use gan-web-bluetooth's isFallbackCall parameter to attempt
watchAdvertisements() first. Only prompt for MAC address if
auto-detection fails."
```

---

### Task 4: Amend ADR-001

**Files:**
- Modify: `docs/decisions/ADR-001-cubing-js-bluetooth.md`

- [ ] **Step 1: Update ADR-001**

Replace the full contents of `docs/decisions/ADR-001-cubing-js-bluetooth.md` with:

```markdown
# ADR-001: Bluetooth library strategy for smart cube communication

## Status
Amended

## Context
We need a BLE library to communicate with smart cubes. The two main options are:

- **`gan-web-bluetooth`** — a standalone library purpose-built for GAN cubes, used by csTimer and Cubeast
- **`cubing.js` bluetooth module** — part of the cubing.js ecosystem, supports multiple cube brands (GAN, Moyu AI, Giiker, others) through a unified `BluetoothPuzzle` interface

We are already deeply dependent on cubing.js for cube state management (`KPuzzle`), scramble generation, and case recognition. Our long-term goal is to support non-GAN smart cubes.

## Original Decision
Use the cubing.js bluetooth module.

## Original Rationale
- **Multi-brand support:** cubing.js supports GAN, Moyu, Giiker, and others through a single interface. `gan-web-bluetooth` is GAN-only — supporting additional brands would require adding and integrating separate libraries.
- **Ecosystem coherence:** Using cubing.js for both BLE communication and cube state avoids translating between two libraries' move representations. Move events from the bluetooth module are already in cubing.js notation.
- **Reduced dependency surface:** One library instead of two. We're already committed to cubing.js for core logic.
- **Unified abstraction:** cubing.js's `BluetoothPuzzle` interface is close to the `CubeConnection` abstraction we need, reducing the wrapper code we write.

## Amendment (2026-03-19)

### What changed
cubing.js's bluetooth module does not support the GAN 356i Carry E, which uses a Gen4
protocol not yet implemented in cubing.js. We switched to `gan-web-bluetooth` for GAN
cube BLE communication while continuing to use cubing.js `KPuzzle` for state management.

### Current approach
- **GAN cubes:** `gan-web-bluetooth` handles BLE connection and move events.
  Move strings are converted to cubing.js `Move` objects for state tracking.
- **State management:** cubing.js `KPuzzle` remains the single source of truth for
  cube state, regardless of which BLE library provides the connection.
- **Abstraction:** The `CubeConnection` interface isolates callers from the BLE
  library choice. `GanBluetoothConnection` implements this interface using
  `gan-web-bluetooth`; the existing `WebBluetoothCubeConnection` wraps cubing.js
  bluetooth for future non-GAN cube support.

### Long-term plan
Both libraries will likely be needed:
- `gan-web-bluetooth` for GAN cubes (best GAN protocol support)
- cubing.js bluetooth for Moyu, Giiker, and other brands (multi-brand unified interface)

Each brand gets its own `CubeConnection` implementation. The abstraction already
supports this — no architectural changes needed when adding new cube brands.

## Risks
- Two BLE libraries increases the dependency surface.
- Move notation may differ between libraries, requiring translation in each
  `CubeConnection` implementation.

## Consequences
- Our `CubeConnection` abstraction wraps different BLE libraries per cube brand,
  not a single unified library.
- Adding support for new cube brands requires evaluating which BLE library to use
  and writing a new `CubeConnection` implementation.
- We accept both cubing.js and gan-web-bluetooth as dependencies.
```

- [ ] **Step 2: Commit**

```bash
git add docs/decisions/ADR-001-cubing-js-bluetooth.md
git commit -m "docs: amend ADR-001 to reflect gan-web-bluetooth usage

cubing.js bluetooth doesn't support GAN 356i Carry E (Gen4 protocol).
Document the dual-library approach and long-term plan for multi-brand
cube support."
```

---

### Task 5: Verify Everything

- [ ] **Step 1: Run full test suite**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: PASS

---

## Notes for Implementer

1. **TwistyPlayer is a custom element.** It extends `HTMLElement` and registers itself
   as `<twisty-player>`. When you do `new TwistyPlayer(config)`, you get an HTML element
   you can `appendChild` into the DOM. It renders itself via `connectedCallback()`.

2. **`experimentalAddMove()` accepts `Move | string`.** Since our `CubeMoveEvent.move`
   is already a cubing.js `Move` object, pass it directly — no string conversion needed.

3. **`jumpToEnd()` skips animation to show current state.** Without this call, TwistyPlayer
   would animate through all added moves. Call it after each batch of new moves.

4. **The `moves` effect has no `instanceKey` dependency.** When `instanceKey` changes,
   the first effect recreates the player and resets `fedCountRef` to 0. The next render
   will have an empty `moves` array (from the hook's `resetState`), so the second effect
   is a no-op. When new moves arrive, they're fed starting from index 0.

5. **`_device` parameter in MAC provider.** The first argument to `MacAddressProvider`
   is the `BluetoothDevice`. We prefix with `_` since we don't use it — the prompt
   doesn't need device info.
