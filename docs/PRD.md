# acubemy — Product Requirements Document

## What this is
A personal speedcubing training tool. A smart cube connects via Bluetooth, solves are recorded and automatically segmented into CFOP phases (Cross, F2L, OLL, PLL). The tool recognizes specific OLL/PLL cases and F2L pair cases, and uses structured training to surface weak cases for targeted drilling.

This is a local, offline-first, single-user training tool. No accounts, no social features, no server-side storage, no community data.

## What done looks like
- Smart cube connects reliably in desktop Chrome via Web Bluetooth
- Scrambles are generated and the app detects when the scramble has been applied
- Solves are recorded, timed, and stored locally
- Solves are automatically segmented into Cross / F2L / OLL / PLL phases with per-phase timing
- OLL cases (57) and PLL cases (21) are recognized and labelled correctly
- F2L pair cases are recognized (stretch goal)
- Training experience surfaces weak cases for drilling based on solve history
- All data lives in local storage / IndexedDB — no backend dependency for core functionality
- iOS deployment via Capacitor is a future add-on (not required for v1)

## Out of scope (permanently)
- User accounts or authentication
- Server-side solve storage or sync
- Social features, leaderboards, community data
- Tournament or competition tooling
- Support for non-CFOP methods (for now)

## Platform targets
- Primary: Desktop web via Web Bluetooth (Chrome/Edge)
- Future: iOS via Capacitor (CoreBluetooth) — designed for but not built initially
- Non-goal: Firefox, Safari desktop (no Web Bluetooth support)

## Tech stack
- **UI:** React + TypeScript
- **Build:** Vite
- **Testing:** Vitest
- **Styling:** Tailwind CSS
- **Persistence:** IndexedDB via `idb`
- **Cube logic:** cubing.js (state management, scrambles, bluetooth, case recognition)
- **Future native wrapper:** Capacitor

## Key external dependencies
- `cubing.js` — cube state, alg parsing, bluetooth communication, scramble generation, case recognition
- `idb` — thin IndexedDB promise wrapper
- Capacitor (future) — iOS native wrapper

## Phases
0. **Project scaffolding** — React, Vite, Vitest, Tailwind, TypeScript, directory structure
1. **Bluetooth + cube state** — connect to cube via Web Bluetooth, receive move events, maintain accurate cube state
2. **Scrambles + solve detection** — generate scrambles, detect scrambled state reached, start/stop timer, record solves
3. **CFOP segmentation** — detect Cross/F2L/OLL/PLL phase boundaries during a solve, per-phase split times
4. **Case recognition** — identify OLL/PLL cases from cube state at phase boundaries
5. **Training experience** — structured training, weak case surfacing, drill mode (details TBD)

## Architectural constraints
See `docs/invariants.md`.
