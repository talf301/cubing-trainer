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
