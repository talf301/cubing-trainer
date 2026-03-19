# Phase 0: Project Scaffolding

## Context
Set up the project foundation before any feature work begins.

## Depends on
None.

## Goals
A working React + TypeScript project with build tooling, testing, styling, and directory
structure in place. A developer can run `npm run dev`, see a page, and run `npm test`.

## Acceptance criteria
- [ ] React + TypeScript project initialized with Vite
- [ ] Vitest configured and a trivial test passes
- [ ] Tailwind CSS installed and working
- [ ] ESLint + TypeScript strict mode configured
- [ ] Directory structure established (see below)
- [ ] `npm run dev`, `npm run build`, `npm run test`, `npm run typecheck` all work
- [ ] cubing.js and idb added as dependencies

## Directory structure (initial)
```
src/
  app/           — React app shell, routing, top-level layout
  components/    — shared UI components
  features/      — feature modules (bluetooth, solves, training, etc.)
  core/          — framework-agnostic logic (cube state, case recognition, scheduler)
  lib/           — thin wrappers (IndexedDB, etc.)
```

The `core/` directory enforces the invariant that training logic is framework-agnostic.
Feature modules in `features/` can import from `core/` but not vice versa.

## Out of scope
- Any feature code
- Capacitor setup (deferred until iOS is needed)
- CI/CD pipeline

## Status
complete
