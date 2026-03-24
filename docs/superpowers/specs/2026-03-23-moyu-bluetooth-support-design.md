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
- MAC address extracted from BLE advertisement manufacturer data (last 6 bytes, reversed), with fallback to derivation from device name (`CF:30:16:00:XX:XX` from `WCU_MY32_XXXX` — best-effort, only if name matches pattern). If neither method works, prompt user for MAC (same as GAN fallback)
- Uses Web Crypto API (`SubtleCrypto`) for AES-128-ECB decryption. The CBC-like chaining is done manually (matching cstimer's approach)

**Message types (opcode = first byte after decryption):**
- `0xA1` (161) — Hardware info response: device name, hardware/software version (logged, not exposed)
- `0xA3` (163) — Facelet state: 48 stickers × 3 bits = 144 bits, face order FBUDLR remapped to URFDLB. Used only for initial state sync on connection
- `0xA4` (164) — Battery level: percentage in bits 8–16
- `0xA5` (165) — Move event: move counter (8 bits), 5 moves (5 bits each), 5 timestamps (16 bits each, ms between moves). Move encoding: `m >> 1` indexes into `"FBUDLR"`, `m & 1` gives CW (0) or CCW (1)

**Facelet-to-KPattern conversion:**

The MoYu protocol provides facelets (sticker colors), not cubie data (CP/CO/EP/EO). Converting facelets to a `KPattern` requires decomposing the 54-facelet string into corner and edge pieces:

1. Parse 144 bits into 54 facelets (48 sticker bits + 6 inserted centers) in URFDLB order
2. For each of the 8 corner positions, read the 3 surrounding facelets and identify which corner piece occupies that slot and its orientation (0, 1, or 2). This produces `CORNERS.pieces[8]` and `CORNERS.orientation[8]`
3. For each of the 12 edge positions, read the 2 surrounding facelets and identify which edge piece occupies that slot and its orientation (0 or 1). This produces `EDGES.pieces[12]` and `EDGES.orientation[12]`
4. Construct a `KPattern` using `kpuzzle.defaultPattern()` and setting the `CORNERS` and `EDGES` orbit data
5. **Validation:** After parsing, verify the state is reachable: total corner orientation mod 3 must equal 0, total edge orientation mod 2 must equal 0, and corner/edge permutation parity must match. If validation fails, log a warning and fall back to solved state

Unit tests will cover known facelet strings (solved, superflip, T-perm, etc.) mapped to expected KPattern orbit data.

**State management:**
- On connection, request facelet state (opcode 163) and parse into a cubing.js `KPattern` via the conversion above
- On each move event, convert FBUDLR notation to standard URFDLB, create cubing.js `Move`, apply to `KPattern`, emit `CubeMoveEvent`
- Move counter gap handling (counter is 8-bit, use `(newCnt - prevCnt) & 0xFF` for wraparound):
  - If gap is 1–5 moves: extract the missed moves from the 5-move buffer using the move counter delta
  - If gap exceeds 5 moves: request a full facelet state resync (opcode 163) and reconstruct the `KPattern` from scratch
- Track device timestamps with local time offset correction (same as cstimer)

**Disconnect detection:**
- Listen to `device.addEventListener('gattserverdisconnected', ...)` to detect BLE disconnection and transition status to "disconnected"

### Modified file: `src/core/cube-connection.ts`

Add optional battery support to the interface:

```typescript
export interface CubeConnection {
  // ... existing members ...
  readonly battery: number | null;
  addBatteryListener?(callback: (level: number) => void): void;
  removeBatteryListener?(callback: (level: number) => void): void;
}
```

Battery methods are optional (marked with `?`) so that `WebBluetoothCubeConnection` (which doesn't support battery) doesn't need stub implementations. The `battery` property is required but defaults to `null` — all existing implementations (`GanBluetoothConnection`, `WebBluetoothCubeConnection`) must add `readonly battery: number | null = null`.

### New file: `src/features/bluetooth/smart-cube-connection.ts`

A `CubeConnection` wrapper that handles multi-brand device selection:

1. `connect()` calls `navigator.bluetooth.requestDevice()` with combined filters:
   - `{ namePrefix: "GAN" }` — GAN cubes
   - `{ namePrefix: "MG" }` — GAN cubes (Monster Go)
   - `{ namePrefix: "AiCube" }` — GAN/MoYu AI 2023
   - `{ namePrefix: "WCU_MY3" }` — MoYu V10/V11
   - `optionalServices`: all GAN service UUIDs + MoYu service UUID
   - `optionalManufacturerData`: combined GAN + MoYu CIC lists
2. Based on the selected device name, delegates to the appropriate connection class
3. Forwards all `CubeConnection` methods to the active delegate
4. On disconnect, clears the delegate so a different cube type can be selected next time

### Modified file: `src/features/bluetooth/gan-bluetooth-connection.ts`

Refactor to accept a pre-selected `BluetoothDevice` instead of calling `connectGanCube()`. This is feasible because `gan-web-bluetooth` exports all needed building blocks:

- `GanCubeClassicConnection.create(device, commandChrct, stateChrct, encrypter, driver)` — creates connection from pre-selected device
- `GanGen2ProtocolDriver`, `GanGen3ProtocolDriver`, `GanGen4ProtocolDriver` — protocol handlers
- `GanGen2CubeEncrypter`, `GanGen3CubeEncrypter`, `GanGen4CubeEncrypter` — decryption
- All service/characteristic UUID constants
- `GAN_ENCRYPTION_KEYS`, `GAN_CIC_LIST`

The device is passed via constructor (`new GanBluetoothConnection(device)`), not via `connect()`, so the `CubeConnection` interface contract (`connect(): Promise<void>`) is preserved. The `connect()` method then:
1. Resolves MAC address via `watchAdvertisements()` (reimplemented, ~20 lines — the library's `autoRetrieveMacAddress` is not exported) with fallback to user prompt
2. Connects GATT, discovers services, matches service UUID to protocol generation
3. Creates encrypter + driver + `GanCubeClassicConnection.create()`
4. Subscribes to events and emits `CubeMoveEvent`s as before

Also adds battery support by handling `BATTERY` events from `gan-web-bluetooth` (already emitted, just not consumed currently).

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

## ADR update

ADR-001 will be amended to reflect that MoYu V10/V11 support is implemented as a custom driver ported from cstimer, rather than via cubing.js's `connectSmartPuzzle()` (which does not support these models). The two-library strategy remains: `gan-web-bluetooth` low-level APIs for GAN cubes, custom driver for MoYu, with both wrapped behind `SmartCubeConnection`.

## Dependencies

- No new npm dependencies. AES via Web Crypto API, key constants pre-decompressed.

## Testing approach

- Unit tests for AES decryption/encryption using known test vectors
- Unit tests for message parsing (facelet state, move events, battery)
- Unit tests for facelet-to-KPattern conversion against known cube states (solved, T-perm, superflip)
- Unit tests for facelet validation (reject impossible states)
- Unit tests for move counter gap handling (1-move gap, 5-move gap, >5-move gap triggering resync)
- Integration testing requires a physical MoYu WRM V11 AI cube (manual)

## Known limitations

- **Chrome CIC bug:** Chrome crashes on BLE advertisements with CIC 0x0000 (affects unbound cubes or cubes with low account IDs < 65536). We use the same cstimer workaround: only scan CICs 0x0100–0xFF00. Unbound cubes require manual MAC entry.
