# MoYu WRM V10/V11 AI Bluetooth Support

## Summary

Add Bluetooth support for MoYu WeiLong WRM V10/V11 AI smart cubes, and unify device selection so the user can connect any supported cube (GAN or MoYu) from a single "Connect" button.

## Context

The app currently supports GAN smart cubes via `gan-web-bluetooth`. MoYu V10/V11 cubes use a distinct BLE protocol (different service UUID, different encryption, different message format). No existing open-source library supports these cubes in a way we can use directly, but cstimer's `moyu32cube.js` provides a complete, proven reference implementation under the GPLv3 license.

## Design

### New file: `src/features/bluetooth/moyu-bluetooth-connection.ts`

A `CubeConnection` implementation for MoYu WRM V10/V11 AI cubes, ported from cstimer's `moyu32cube.js`.

**BLE identifiers:**
- Service UUID: `0783b03e-7735-b5a0-1760-a305d2795cb0`
- Read characteristic (notifications): `0783b03e-7735-b5a0-1760-a305d2795cb1`
- Write characteristic (commands): `0783b03e-7735-b5a0-1760-a305d2795cb2`
- Device name prefix: `WCU_MY3`

**Encryption:**
- AES-128, same scheme as GAN Gen2/3 but with MoYu-specific base keys
- Key and IV derived from two compressed constants (pre-decompressed at build time, no `lz-string` dependency) XORed with the reversed 6-byte MAC address
- MAC address extracted from BLE advertisement manufacturer data (last 6 bytes, reversed), with fallback to derivation from device name (`CF:30:16:00:XX:XX` from `WCU_MY32_XXXX`)
- Uses Web Crypto API (`SubtleCrypto`) for AES-128-ECB decryption. The CBC-like chaining is done manually (matching cstimer's approach)

**Message types (opcode = first byte after decryption):**
- `0xA1` (161) — Hardware info response: device name, hardware/software version (logged, not exposed)
- `0xA3` (163) — Facelet state: 48 stickers × 3 bits = 144 bits, face order FBUDLR remapped to URFDLB. Used only for initial state sync on connection
- `0xA4` (164) — Battery level: percentage in bits 8–16
- `0xA5` (165) — Move event: move counter (8 bits), 5 moves (5 bits each), 5 timestamps (16 bits each, ms between moves). Move encoding: `m >> 1` indexes into `"FBUDLR"`, `m & 1` gives CW (0) or CCW (1)

**State management:**
- On connection, request facelet state (opcode 163) and parse into a cubing.js `KPattern`
- On each move event, convert FBUDLR notation to standard URFDLB, create cubing.js `Move`, apply to `KPattern`, emit `CubeMoveEvent`
- Handle move counter gaps (lost BLE events) by processing the most recent N moves from the 5-move buffer
- Track device timestamps with local time offset correction (same as cstimer)

**Facelet-to-KPattern conversion:**
- Parse 144 bits into 54 facelets (48 sticker bits + 6 inserted centers) in URFDLB order
- Convert facelet string to `KPattern` by mapping sticker colors to piece positions/orientations using cubing.js utilities

### Modified file: `src/core/cube-connection.ts`

Add optional battery support to the interface:

```typescript
export interface CubeConnection {
  // ... existing members ...
  readonly battery: number | null;
  addBatteryListener(callback: (level: number) => void): void;
  removeBatteryListener(callback: (level: number) => void): void;
}
```

### New file: `src/features/bluetooth/smart-cube-connection.ts`

A `CubeConnection` wrapper that handles multi-brand device selection:

1. `connect()` calls `navigator.bluetooth.requestDevice()` with combined filters:
   - `{ namePrefix: "GAN" }` — GAN cubes
   - `{ namePrefix: "MiSmartHub" }` — GAN cubes (alternative name)
   - `{ namePrefix: "WCU_MY3" }` — MoYu V10/V11
2. Based on the selected device name, instantiates and delegates to either `GanBluetoothConnection` or `MoYuBluetoothConnection`
3. Forwards all `CubeConnection` methods to the active delegate
4. On disconnect, clears the delegate so a different cube type can be selected next time

### Modified file: `src/features/bluetooth/gan-bluetooth-connection.ts`

Refactor to accept an already-selected `BluetoothDevice` from the wrapper, rather than calling `connectGanCube()` internally. This allows the `SmartCubeConnection` to control device selection while GAN handles its own protocol. Also add battery support (the GAN protocol already provides battery data via `gan-web-bluetooth`).

### Modified file: `src/app/routes.tsx`

Replace `new GanBluetoothConnection()` with `new SmartCubeConnection()`.

### Modified file: `src/features/bluetooth/use-cube-connection.ts`

Add `battery` to the returned state, sourced from `CubeConnection.battery` and battery listeners.

### UI: Battery display

Show battery percentage in the debug page connection info area. Simple text display (e.g., "Battery: 85%"), only shown when connected and battery data is available.

## What does NOT change

- No changes to any trainer, solver, or core logic — they all work through `CubeConnection`
- No changes to `WebBluetoothCubeConnection` (cubing.js-based, kept for future use)
- Gyro/orientation data from the MoYu protocol is ignored

## Dependencies

- No new npm dependencies. AES via Web Crypto API, key constants pre-decompressed.

## Testing approach

- Unit tests for message parsing (decryption, facelet parsing, move decoding) using known test vectors from the cstimer implementation
- Unit tests for facelet-to-KPattern conversion
- Integration testing requires a physical MoYu WRM V11 AI cube (manual)

## Open questions

- **Chrome CIC bug:** Chrome crashes when receiving BLE advertisements with Company Identifier Code 0x0000 (affects unbound cubes or cubes with low account IDs). The cstimer workaround is to only scan CICs 0x0100–0xFF00. We'll use the same approach — if the cube is unbound, MAC discovery fails and the user gets a manual MAC prompt as fallback. This matches the GAN cube experience.
- **GAN connection refactor scope:** The `gan-web-bluetooth` library's `connectGanCube()` handles its own `requestDevice` call. To let `SmartCubeConnection` control device selection, we either (a) refactor `GanBluetoothConnection` to accept a pre-selected device and use lower-level `gan-web-bluetooth` APIs, or (b) keep `GanBluetoothConnection` as-is and have `SmartCubeConnection` detect the cube type *before* connecting (e.g., do a `requestDevice` scan, check the name, disconnect, then delegate to the appropriate connection which re-prompts). Option (a) is cleaner but depends on what `gan-web-bluetooth` exposes. Option (b) is simpler but causes a double-prompt. Will resolve during implementation by checking the `gan-web-bluetooth` API surface.
