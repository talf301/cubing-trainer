# Phase 1: Bluetooth + Cube State

## Context
Foundation phase. Nothing else can be built until we can reliably connect to a smart cube
and maintain accurate cube state from move events.

## Depends on
Phase 0 (Project Scaffolding)

## Goals
Establish a reliable Web Bluetooth connection to a smart cube using cubing.js's bluetooth
module, receive move events, and maintain a fully accurate cube state using KPuzzle.
The Bluetooth layer must be behind a `CubeConnection` abstraction so a Capacitor/CoreBluetooth
implementation can be added later without changing callers.

## Acceptance criteria
- [x] Connects to a GAN 356i Carry E on desktop via Web Bluetooth (Chrome)
- [x] Bluetooth interface is behind a `CubeConnection` abstraction — callers don't know the platform
- [x] Move events are received and translated to cubing.js move notation correctly
- [x] Cube state is maintained accurately via KPuzzle — verified by doing a known sequence and checking state
- [x] Connection loss is detected and surfaced to the caller; reconnection is possible without reload
- [x] A minimal debug UI shows connection status, last moves received, and current cube state
- [x] Unit tests cover move translation and state management logic

## Out of scope
- Capacitor / CoreBluetooth / iOS — deferred to a future phase
- Support for non-GAN cubes (the abstraction supports it, but only GAN is tested)
- Any UI beyond a minimal connection debug view
- Solve detection or timing

## Key technical notes
- ~~Use cubing.js `BluetoothPuzzle` as the underlying connection (see ADR-001).~~
  **Update:** cubing.js bluetooth doesn't support GAN 356i Carry E (Gen4 protocol).
  Using `gan-web-bluetooth` for BLE, cubing.js KPuzzle for state management.
- `CubeConnection` abstraction should be thin — mostly forwarding cubing.js's interface
  with a platform-switchable factory. Don't over-abstract.
- cubing.js `KPuzzle` is the right primitive for state management — not the higher-level
  `TwistyPlayer` which is UI-coupled.
- Design the `CubeConnection` interface so a Capacitor implementation can be added later
  by implementing the same interface, but don't build that implementation now.

## Status
complete

<!-- 2026-03-19: All acceptance criteria met. CubeViewer replaced CubeSvgViewer (TwistyPlayer instead of ExperimentalSVGAnimator). MAC auto-detection added with prompt fallback. ADR-001 amended. Smoke tested with GAN 356i Carry E — connection, moves, state, and visualization all working. 17 tests passing. -->

