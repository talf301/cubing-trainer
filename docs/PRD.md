# acubemy — Product Requirements Document

## What this is
A personal speedcubing training tool. A smart cube connects via Bluetooth, solves are recorded and automatically segmented into CFOP phases (Cross, F2L, OLL, PLL). The tool recognizes specific OLL/PLL cases and F2L pair cases, and uses spaced repetition to surface weak cases for targeted drilling.

This is a local, offline-first, single-user training tool. No accounts, no social features, no server-side storage, no community data.

## What done looks like
- Smart cube connects reliably on iOS via Capacitor/CoreBluetooth and on desktop via Web Bluetooth
- Solves are recorded, timed, and stored locally
- Solves are automatically segmented into Cross / F2L / OLL / PLL phases with per-phase timing
- OLL cases (57) and PLL cases (21) are recognized and labelled correctly
- F2L pair cases are recognized (stretch goal)
- Spaced repetition scheduler surfaces weak cases for drilling based on solve history
- Training session UI lets you drill a specific case or a surfaced weak case set
- All data lives in local storage / IndexedDB — no backend dependency for core functionality
- iOS deployment works via Capacitor wrapping the web app

## Out of scope (permanently)
- User accounts or authentication
- Server-side solve storage or sync
- Social features, leaderboards, community data
- Tournament or competition tooling
- Support for non-CFOP methods (for now)

## Platform targets
- Primary: iOS via Capacitor (CoreBluetooth)
- Secondary: Desktop web via Web Bluetooth (Chrome/Edge)
- Non-goal: Firefox, Safari desktop (no Web Bluetooth support)

## Key external dependencies
- `cubing.js` — cube state, alg parsing, case recognition
- `gan-web-bluetooth` or `cubing.js` bluetooth module — smart cube BT connectivity
- Capacitor — iOS native wrapper
- Local persistence: IndexedDB (via a thin wrapper, not a full ORM)

## Phases
1. **Bluetooth + cube state** — connect to cube, receive move events, maintain accurate cube state
2. **Solve recording + CFOP segmentation** — detect solve start/end, segment into phases, record timing
3. **Case recognition** — identify OLL/PLL cases; F2L pair recognition as stretch
4. **Spaced repetition + training UI** — scheduler, drill mode, weak case surfacing, analytics

## Architectural constraints
See `docs/invariants.md`.
