# Phase 1 Fixes: CubeViewer, MAC Auto-Detection, ADR-001 Amendment

Three targeted fixes to complete Phase 1 (Bluetooth + Cube State).

## 1. CubeViewer — Replace ExperimentalSVGAnimator with TwistyPlayer

### Problem

`CubeSvgViewer` uses cubing.js's `ExperimentalSVGAnimator` to render cube state as SVG.
The component doesn't render in the browser — likely due to the interaction between
React StrictMode's double-mount lifecycle and the animator's imperative DOM manipulation.
`ExperimentalSVGAnimator` is an unstable internal API with no guarantees.

### Solution

Replace `CubeSvgViewer` with `CubeViewer`, wrapping cubing.js's `<twisty-player>` web
component. TwistyPlayer is the officially supported rendering API and manages its own
DOM lifecycle, avoiding conflicts with React.

### Interface

```typescript
interface CubeViewerProps {
  moves: CubeMoveEvent[];
  instanceKey: number; // increment on reset to force new player
}
```

### Behavior

- On mount (or `instanceKey` change): create a `new TwistyPlayer` configured with
  `puzzle: "3x3x3"`, `visualization: "2D"`, `controlPanel: "none"`, `backView: "none"`.
  Append to a container ref.
- Track how many moves have been fed to the player. When `moves` grows, feed only new
  moves via `experimentalAddMove()`, then call `jumpToEnd()`.
- On `instanceKey` change: remove old player, create fresh one (solved state).
- Cleanup on unmount: remove the player element from the container.

### BluetoothDebug changes

- Add `resetCount` state (number, starts at 0, increments on "Reset State" click).
- Pass `moves` and `resetCount` as `instanceKey` to `CubeViewer` instead of `state`
  (KPattern) to `CubeSvgViewer`.
- Remove `state` from the hook return value usage in BluetoothDebug (the hook still
  tracks it internally for other future consumers).

### Files changed

- `src/features/bluetooth/CubeSvgViewer.tsx` → rename to `CubeViewer.tsx`, rewrite
- `src/features/bluetooth/BluetoothDebug.tsx` — update props and add resetCount
- `src/features/bluetooth/__tests__/BluetoothDebug.test.tsx` — update mock name

---

## 2. MAC Address Auto-Detection with Fallback

### Problem

`GanBluetoothConnection.connect()` always prompts the user for the MAC address via
`window.prompt()`. This is unnecessary on platforms where `watchAdvertisements()` works
(Chrome with the experimental flag enabled).

### Solution

Use the `MacAddressProvider` callback's `isFallbackCall` parameter correctly:

- First call (`isFallbackCall` falsy): return `null` to let `gan-web-bluetooth` attempt
  automatic detection via `watchAdvertisements()`.
- Second call (`isFallbackCall: true`): auto-detection failed, prompt the user for
  the MAC address.

This gives seamless connection where supported and falls back gracefully.

### Files changed

- `src/features/bluetooth/gan-bluetooth-connection.ts` — update the `MacAddressProvider`
  callback in `connect()`

---

## 3. ADR-001 Amendment

### Problem

ADR-001 says "use cubing.js bluetooth module" but the implementation uses
`gan-web-bluetooth` because cubing.js doesn't support the GAN 356i Carry E (Gen4
protocol). The phase brief has a note about this but the ADR is stale.

### Solution

Amend ADR-001:

- Change status to "Amended"
- Add an amendment section documenting:
  - cubing.js bluetooth doesn't support GAN 356i Carry E (Gen4 protocol)
  - Using `gan-web-bluetooth` for GAN BLE, cubing.js KPuzzle for state management
  - Long-term plan: both libraries needed — `gan-web-bluetooth` for GAN cubes,
    cubing.js bluetooth for Moyu/Giiker/others
  - The `CubeConnection` abstraction supports this — each brand gets its own
    implementation of the interface

### Files changed

- `docs/decisions/ADR-001-cubing-js-bluetooth.md`
