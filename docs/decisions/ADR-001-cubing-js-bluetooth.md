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

## Amendment 1 (2026-03-19)

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

## Amendment 2 (2026-03-23)

### What changed
Adding MoYu WRM V10/V11 AI smart cube support. cubing.js's bluetooth module does not
support these models, so we ported a custom MoYu driver from cstimer's `moyu32cube.js`
(GPLv3) rather than relying on cubing.js bluetooth for MoYu.

### Current approach
- **GAN cubes:** `gan-web-bluetooth` handles BLE connection and move events.
- **MoYu cubes:** Custom driver (`MoYuBluetoothConnection`) ported from cstimer,
  handling BLE communication, AES-128 encryption, facelet-to-KPattern conversion,
  and move event parsing directly via Web Bluetooth API.
- **State management:** cubing.js `KPuzzle` remains the single source of truth for
  cube state across all cube brands.
- **Abstraction:** `SmartCubeConnection` wraps brand-specific implementations
  (`GanBluetoothConnection`, `MoYuBluetoothConnection`) behind a unified interface,
  handling device selection and routing to the correct driver based on BLE
  advertisement data.
- **cubing.js bluetooth:** `WebBluetoothCubeConnection` is retained for potential
  future use with other brands (Giiker, etc.) but is not actively used.

### Long-term plan
Each cube brand gets its own `CubeConnection` implementation, wrapped by
`SmartCubeConnection`:
- `gan-web-bluetooth` for GAN cubes (best GAN protocol support)
- Custom MoYu driver for MoYu V10/V11 AI cubes (no suitable library exists)
- cubing.js bluetooth remains available for other brands if/when needed

## Risks
- Multiple BLE drivers (gan-web-bluetooth, custom MoYu, potentially cubing.js
  bluetooth) increase the dependency and maintenance surface.
- Move notation differs between drivers, requiring translation in each
  `CubeConnection` implementation.
- The custom MoYu driver is our own code to maintain, unlike the library-backed
  GAN driver.

## Consequences
- Our `CubeConnection` abstraction wraps different BLE drivers per cube brand,
  not a single unified library.
- Adding support for new cube brands requires evaluating whether an existing library
  supports them or whether a custom driver is needed.
- We accept gan-web-bluetooth, cubing.js, and our custom MoYu driver as the BLE stack.
