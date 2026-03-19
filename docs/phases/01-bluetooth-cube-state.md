# Phase 1: Bluetooth + Cube State

## Context
Foundation phase. Nothing else can be built until we can reliably connect to a smart cube
and maintain accurate cube state from move events.

## Depends on
None.

## Goals
Establish a reliable Bluetooth connection to a GAN smart cube (and ideally other brands),
receive move events, and maintain a fully accurate cube state using cubing.js.
The Bluetooth layer must be abstracted so the rest of the app is platform-agnostic.

## Acceptance criteria
- [ ] Connects to a GAN cube on iOS via Capacitor/CoreBluetooth plugin
- [ ] Connects to a GAN cube on desktop via Web Bluetooth (Chrome)
- [ ] Bluetooth interface is behind a `CubeConnection` abstraction — callers don't know the platform
- [ ] Move events are received and translated to cubing.js move notation correctly
- [ ] Cube state is maintained accurately — verified by doing a known sequence and checking state
- [ ] Connection loss is detected and surfaced to the caller; reconnection is possible without reload
- [ ] Unit tests cover move translation and state management logic

## Out of scope
- Any UI beyond a minimal connection debug view
- Solve detection or timing
- Support for non-GAN cubes (nice to have but not blocking)

## Key technical notes
- `gan-web-bluetooth` handles the GAN proprietary BT protocol. Evaluate whether the cubing.js
  bluetooth module covers the same ground before deciding which to use — write an ADR.
- Capacitor plugin for CoreBluetooth: evaluate `@capacitor-community/bluetooth-le` or a custom
  plugin. The GAN protocol layer still needs to run in JS/TS on top of raw BLE.
- cubing.js `KPuzzle` is the right primitive for state management — not the higher-level
  `TwistyPlayer` which is UI-only.
- iOS BT permissions: `NSBluetoothAlwaysUsageDescription` required in Info.plist.

## Status
backlog
