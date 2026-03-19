# Phase 0: Project Scaffolding — Design Spec

## Overview
Set up the acubemy project foundation: React + TypeScript app with Vite, testing, styling, routing, linting, and directory structure. No feature code — just a working shell that all future phases build on.

## Tech Stack
- **React 19** + **TypeScript** (strict mode)
- **Vite** — build and dev server
- **Vitest** — testing with jsdom environment
- **Tailwind CSS v4** — utility-first styling
- **React Router v7** — client-side routing
- **ESLint** + **typescript-eslint** recommended rules + **Prettier** for formatting
- **cubing** and **idb** installed as dependencies (unused until later phases)

## Directory Structure
```
src/
  app/
    App.tsx          — root component, router setup
    Layout.tsx       — shared layout (nav + content area)
    routes.tsx       — route definitions
  components/        — shared UI components (empty initially)
  features/          — feature modules (empty initially)
  core/              — framework-agnostic logic (empty initially)
  lib/               — thin wrappers (empty initially)
  main.tsx           — entry point, renders App
  index.css          — Tailwind imports
```

The `core/` directory enforces the invariant that training logic is framework-agnostic TypeScript. Feature modules in `features/` may import from `core/` but not vice versa.

## Routing
React Router v7 with these placeholder routes:

| Path | View | Purpose |
|------|------|---------|
| `/` | Timer | Home — will become the main solve timer view |
| `/history` | History | Solve history list |
| `/training` | Training | Training/drill mode |
| `/settings` | Settings | App settings |

Each route renders a simple heading (e.g., `<h1>Timer</h1>`) inside the shared layout. The layout includes a nav bar for switching between views.

## Configuration

### TypeScript
- `strict: true` in tsconfig
- Path aliases: `@/` maps to `src/`

### ESLint + Prettier
- `@eslint/js` recommended rules
- `typescript-eslint` recommended type-aware rules
- Prettier for formatting (default config: double quotes can be overridden if preferred)
- ESLint Prettier plugin to surface formatting issues as lint errors

### Vitest
- jsdom environment for React component testing
- One trivial test to verify the setup (e.g., renders App without crashing)

## npm Scripts
| Script | Command |
|--------|---------|
| `dev` | `vite` |
| `build` | `tsc -b && vite build` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `typecheck` | `tsc --noEmit` |
| `lint` | `eslint src/` |
| `format` | `prettier --write src/` |
| `format:check` | `prettier --check src/` |

## Dependencies
**Production:**
- `react`, `react-dom`
- `react-router` (v7)
- `cubing` (unused until Phase 1)
- `idb` (unused until Phase 2)

**Dev:**
- `vite`, `@vitejs/plugin-react`
- `typescript`, `@types/react`, `@types/react-dom`
- `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`
- `tailwindcss`, `@tailwindcss/vite`
- `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `eslint-config-prettier`, `eslint-plugin-prettier`
- `prettier`

## Acceptance Criteria
- [ ] `npm run dev` starts a dev server showing the timer page with nav
- [ ] `npm run build` produces a production build without errors
- [ ] `npm run test` runs and passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] All four routes are navigable
- [ ] Tailwind utility classes work (verified by styling in the placeholder pages)
- [ ] cubing and idb are in package.json (importable but not used)

## What This Does NOT Include
- Any feature code (bluetooth, timer, solves, etc.)
- Capacitor setup
- CI/CD
- State management library (React's built-in state is sufficient to start)
