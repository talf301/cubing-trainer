# ADR-001: Use cubing.js bluetooth module over gan-web-bluetooth

## Status
Accepted

## Context
We need a BLE library to communicate with smart cubes. The two main options are:

- **`gan-web-bluetooth`** — a standalone library purpose-built for GAN cubes, used by csTimer and Cubeast
- **`cubing.js` bluetooth module** — part of the cubing.js ecosystem, supports multiple cube brands (GAN, Moyu AI, Giiker, others) through a unified `BluetoothPuzzle` interface

We are already deeply dependent on cubing.js for cube state management (`KPuzzle`), scramble generation, and case recognition. Our long-term goal is to support non-GAN smart cubes.

## Decision
Use the cubing.js bluetooth module.

## Rationale
- **Multi-brand support:** cubing.js supports GAN, Moyu, Giiker, and others through a single interface. `gan-web-bluetooth` is GAN-only — supporting additional brands would require adding and integrating separate libraries.
- **Ecosystem coherence:** Using cubing.js for both BLE communication and cube state avoids translating between two libraries' move representations. Move events from the bluetooth module are already in cubing.js notation.
- **Reduced dependency surface:** One library instead of two. We're already committed to cubing.js for core logic.
- **Unified abstraction:** cubing.js's `BluetoothPuzzle` interface is close to the `CubeConnection` abstraction we need, reducing the wrapper code we write.

## Risks
- The cubing.js bluetooth module is less mature than `gan-web-bluetooth` and has less GAN-specific documentation.
- If cubing.js bluetooth has bugs with the GAN 356i Carry E specifically, we may need to contribute fixes upstream or work around them.

## Consequences
- Our `CubeConnection` abstraction wraps cubing.js's `BluetoothPuzzle` rather than a raw BLE library.
- Adding support for new cube brands is primarily a cubing.js upstream concern, not ours.
- We accept the coupling to cubing.js as a deliberate choice — it is the foundation of this project.
