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
- [ ] Connects to a GAN 356i Carry E on desktop via Web Bluetooth (Chrome)
- [ ] Bluetooth interface is behind a `CubeConnection` abstraction — callers don't know the platform
- [ ] Move events are received and translated to cubing.js move notation correctly
- [ ] Cube state is maintained accurately via KPuzzle — verified by doing a known sequence and checking state
- [ ] Connection loss is detected and surfaced to the caller; reconnection is possible without reload
- [ ] A minimal debug UI shows connection status, last moves received, and current cube state
- [ ] Unit tests cover move translation and state management logic

## Out of scope
- Capacitor / CoreBluetooth / iOS — deferred to a future phase
- Support for non-GAN cubes (the abstraction supports it, but only GAN is tested)
- Any UI beyond a minimal connection debug view
- Solve detection or timing

## Key technical notes
- Use cubing.js `BluetoothPuzzle` as the underlying connection (see ADR-001).
- `CubeConnection` abstraction should be thin — mostly forwarding cubing.js's interface
  with a platform-switchable factory. Don't over-abstract.
- cubing.js `KPuzzle` is the right primitive for state management — not the higher-level
  `TwistyPlayer` which is UI-coupled.
- Design the `CubeConnection` interface so a Capacitor implementation can be added later
  by implementing the same interface, but don't build that implementation now.

## Status
backlog
