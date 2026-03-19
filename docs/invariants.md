# Invariants

These constraints must never be violated. If a decision would require breaking one,
write an ADR explaining why and get explicit sign-off before proceeding.

## Bluetooth
- On iOS, all Bluetooth communication must go through Capacitor and native CoreBluetooth.
  Web Bluetooth must not be used on iOS — it is effectively broken in practice.
- The Bluetooth layer must be behind an abstraction interface so the rest of the app
  doesn't care whether it's talking to CoreBluetooth via Capacitor or Web Bluetooth on desktop.

## Data and state
- Cube state must be maintained client-side at all times.
  No solve or cube state computation may depend on a network call.
- All solve data is stored locally (IndexedDB). There is no backend.
  Features must not be designed with the assumption that a backend will be added later.

## Architecture
- The core training logic (spaced repetition scheduler, case recognition, phase segmentation)
  must be framework-agnostic TypeScript — not tied to any UI framework or Capacitor.
  This keeps it testable in isolation and portable.
- Case recognition must be deterministic and based on `cubing.js` cube state, not heuristics
  or move-count guesses.

## Scope
- No features that require user identity, accounts, or server-side state.
  If a feature requires these, it is out of scope for this project.
