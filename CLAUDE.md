# acubemy

## Orientation
Before starting any work, read in this order:
1. `docs/PRD.md` — what the project is and what done looks like
2. `docs/invariants.md` — constraints that must never be violated
3. `docs/status.md` — current state of the project
4. The active phase brief in `docs/phases/active/` if one exists

If working on a specific phase, read that phase brief fully before writing any code.

## Key dependencies
- `cubing.js` — cube state, alg parsing, bluetooth, scrambles, case recognition (see ADR-001)
- `idb` — thin IndexedDB promise wrapper
- React + Vite + Tailwind CSS — UI and build
- Vitest — testing
- TypeScript throughout

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run test` — test suite
- `npm run typecheck` — type checking without build

## Decisions
Before making any non-obvious architectural choice, check `docs/decisions/` for existing ADRs.
If making a new architectural decision, write an ADR using `/new-decision` before implementing.

## After finishing work
Run `/end-session` to update status and log what changed.
