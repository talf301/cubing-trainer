# Phase 0: Project Scaffolding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the acubemy project as a working React + TypeScript app with Vite, Vitest, Tailwind, React Router, ESLint, and Prettier — ready for feature development.

**Architecture:** Single-page React app with client-side routing via React Router. A shared Layout component wraps all routes with a nav bar. Source organized into `app/` (shell), `components/` (shared UI), `features/` (feature modules), `core/` (framework-agnostic logic), and `lib/` (wrappers). The `core/` directory must never import from React or any UI framework.

**Tech Stack:** React 19, TypeScript (strict), Vite, Vitest + jsdom + Testing Library, Tailwind CSS v4, React Router v7, ESLint + typescript-eslint + Prettier, cubing, idb

**Spec:** `docs/superpowers/specs/2026-03-19-phase0-scaffolding-design.md`

---

## File Map

```
(create) package.json
(create) tsconfig.json
(create) tsconfig.app.json
(create) tsconfig.node.json
(create) vite.config.ts
(create) eslint.config.js
(create) .prettierrc
(create) index.html
(create) src/main.tsx
(create) src/index.css
(create) src/vite-env.d.ts
(create) src/app/App.tsx
(create) src/app/App.test.tsx
(create) src/app/Layout.tsx
(create) src/app/routes.tsx
(create) src/components/.gitkeep
(create) src/features/.gitkeep
(create) src/core/.gitkeep
(create) src/lib/.gitkeep
(create) vitest.setup.ts
```

---

### Task 1: Initialize Vite + React + TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: Scaffold the project with Vite**

Run:
```bash
npm create vite@latest . -- --template react-ts
```

The directory is not empty (it has `docs/`, `CLAUDE.md`, etc.). Use the `--force` flag if Vite prompts, or if that's not available, temporarily move the existing files, scaffold, then move them back. Alternatively, scaffold in a temp directory and copy the template files over. The key files needed from the template are: `package.json`, `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/App.css`, `src/index.css`, `src/vite-env.d.ts`.

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install
```

- [ ] **Step 3: Verify the scaffold works**

Run:
```bash
npm run dev
```

Expected: Dev server starts, opens a page with the Vite + React template.

Stop the dev server (Ctrl+C).

- [ ] **Step 4: Enable strict TypeScript**

Edit `tsconfig.app.json` — ensure `strict: true` is present (Vite's React-TS template includes it by default, but verify).

Add the path alias. In `tsconfig.app.json`, inside `compilerOptions`:
```json
"baseUrl": ".",
"paths": {
  "@/*": ["src/*"]
}
```

- [ ] **Step 5: Configure Vite for the path alias**

Edit `vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

If `path` shows a type error, run `npm install -D @types/node`.

- [ ] **Step 6: Verify build still works**

Run:
```bash
npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite + React + TypeScript project"
```

---

### Task 2: Add Tailwind CSS v4

**Files:**
- Create: `src/index.css`
- Modify: `vite.config.ts`

- [ ] **Step 1: Install Tailwind CSS v4 and its Vite plugin**

Run:
```bash
npm install -D tailwindcss @tailwindcss/vite
```

- [ ] **Step 2: Add the Tailwind Vite plugin**

Edit `vite.config.ts` — add the Tailwind plugin:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

- [ ] **Step 3: Set up the CSS entry point**

Replace the contents of `src/index.css` with:
```css
@import "tailwindcss";
```

- [ ] **Step 4: Ensure `src/main.tsx` imports `index.css`**

The Vite template should already import `./index.css` in `main.tsx`. Verify this line exists:
```typescript
import "./index.css";
```

- [ ] **Step 5: Verify Tailwind works**

Edit `src/App.tsx` temporarily — add a Tailwind class to any element, e.g. `<h1 className="text-3xl font-bold text-blue-500">`. Run `npm run dev` and verify the styling applies. Revert the change.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Tailwind CSS v4 with Vite plugin"
```

---

### Task 3: Add ESLint + Prettier

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install ESLint and Prettier packages**

Run:
```bash
npm install -D eslint @eslint/js typescript-eslint eslint-plugin-react-hooks eslint-plugin-prettier prettier
```

Note: The Vite template may have installed some ESLint packages already. That's fine — npm will dedupe.

- [ ] **Step 2: Create ESLint config**

Replace the Vite-generated `eslint.config.js` entirely with:
```javascript
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  { ignores: ["dist"] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  prettier,
);
```

- [ ] **Step 3: Create Prettier config**

Create `.prettierrc`:
```json
{}
```

This uses Prettier defaults (double quotes, semicolons, 80 char width, trailing commas).

- [ ] **Step 4: Add lint and format scripts to package.json**

Add to the `"scripts"` section:
```json
"lint": "eslint src/",
"format": "prettier --write src/",
"format:check": "prettier --check src/"
```

- [ ] **Step 5: Run formatter on existing code**

Run:
```bash
npm run format
```

- [ ] **Step 6: Run lint and verify it passes**

Run:
```bash
npm run lint
```

Expected: No errors. If there are errors from the Vite template code, fix them (likely minor — unused imports, etc.).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add ESLint with typescript-eslint and Prettier"
```

---

### Task 4: Add Vitest + Testing Library

**Files:**
- Create: `vitest.setup.ts`
- Modify: `vite.config.ts`
- Modify: `tsconfig.app.json`
- Modify: `package.json` (scripts)

- [ ] **Step 1: Install Vitest and Testing Library**

Run:
```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Create Vitest setup file**

Create `vitest.setup.ts`:
```typescript
import "@testing-library/jest-dom/vitest";
```

This adds custom matchers like `toBeInTheDocument()` to all test files.

- [ ] **Step 3: Configure Vitest in vite.config.ts**

Add a `/// <reference types="vitest" />` comment at the top of `vite.config.ts`, and add the `test` config:

```typescript
/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./vitest.setup.ts",
  },
});
```

- [ ] **Step 4: Add test types to tsconfig**

Edit `tsconfig.app.json` — add `"vitest/globals"` to the `compilerOptions.types` array (create it if it doesn't exist):
```json
"types": ["vitest/globals"]
```

- [ ] **Step 5: Add test scripts to package.json**

Add/update the `"scripts"` section:
```json
"test": "vitest run",
"test:watch": "vitest",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 6: Verify with a trivial test**

Create a temporary test file `src/smoke.test.ts`:
```typescript
describe("vitest setup", () => {
  it("works", () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run:
```bash
npm run test
```

Expected: 1 test passes. Delete `src/smoke.test.ts` after verifying.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Vitest with Testing Library and jsdom"
```

---

### Task 5: Add React Router + placeholder routes

**Files:**
- Create: `src/app/App.tsx`
- Create: `src/app/Layout.tsx`
- Create: `src/app/routes.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Install React Router**

Run:
```bash
npm install react-router
```

- [ ] **Step 2: Create route definitions**

Create `src/app/routes.tsx`:
```tsx
function Timer() {
  return <h1 className="text-2xl font-bold">Timer</h1>;
}

function History() {
  return <h1 className="text-2xl font-bold">History</h1>;
}

function Training() {
  return <h1 className="text-2xl font-bold">Training</h1>;
}

function Settings() {
  return <h1 className="text-2xl font-bold">Settings</h1>;
}

export { Timer, History, Training, Settings };
```

- [ ] **Step 3: Create the Layout component**

Create `src/app/Layout.tsx`:
```tsx
import { NavLink, Outlet } from "react-router";

const navItems = [
  { to: "/", label: "Timer" },
  { to: "/history", label: "History" },
  { to: "/training", label: "Training" },
  { to: "/settings", label: "Settings" },
];

export default function Layout() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-3">
        <ul className="flex gap-6">
          {navItems.map(({ to, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  isActive
                    ? "text-white font-semibold"
                    : "text-gray-400 hover:text-white"
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
      <main className="px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Create the App component with router**

Create `src/app/App.tsx`:
```tsx
import { BrowserRouter, Routes, Route } from "react-router";
import Layout from "./Layout";
import { Timer, History, Training, Settings } from "./routes";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Timer />} />
          <Route path="/history" element={<History />} />
          <Route path="/training" element={<Training />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Update main.tsx**

Replace `src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./app/App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 6: Remove Vite template boilerplate**

Delete files that came with the Vite template that are no longer needed:
- `src/App.tsx` (replaced by `src/app/App.tsx`)
- `src/App.css`
- `src/assets/` directory (if it exists)
- Any other Vite template files (`src/logo.svg`, etc.)

- [ ] **Step 7: Verify routing works**

Run:
```bash
npm run dev
```

Expected: Page loads showing "Timer" heading with nav bar. Clicking each nav link shows the corresponding heading. All four routes work.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add React Router with placeholder routes and layout"
```

---

### Task 6: Add directory structure + cubing/idb dependencies

**Files:**
- Create: `src/components/.gitkeep`
- Create: `src/features/.gitkeep`
- Create: `src/core/.gitkeep`
- Create: `src/lib/.gitkeep`

- [ ] **Step 1: Create empty directories with .gitkeep files**

Run:
```bash
mkdir -p src/components src/features src/core src/lib
touch src/components/.gitkeep src/features/.gitkeep src/core/.gitkeep src/lib/.gitkeep
```

- [ ] **Step 2: Install cubing and idb**

Run:
```bash
npm install cubing idb
```

These are production dependencies — unused until Phase 1 and Phase 2 respectively, but installed now so the project is ready.

- [ ] **Step 3: Verify typecheck passes with new deps**

Run:
```bash
npm run typecheck
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add directory structure and install cubing + idb"
```

---

### Task 7: Write App smoke test + run full verification

**Files:**
- Create: `src/app/App.test.tsx`

- [ ] **Step 1: Write the smoke test**

Create `src/app/App.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the timer page by default", () => {
    render(<App />);
    expect(screen.getByText("Timer")).toBeInTheDocument();
  });

  it("renders the navigation", () => {
    render(<App />);
    expect(screen.getByText("History")).toBeInTheDocument();
    expect(screen.getByText("Training")).toBeInTheDocument();
    expect(screen.getByText("Settings")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests**

Run:
```bash
npm run test
```

Expected: All tests pass.

- [ ] **Step 3: Run full verification suite**

Run each command and verify it succeeds:
```bash
npm run typecheck
npm run lint
npm run build
```

Expected: All three pass with no errors.

- [ ] **Step 4: Fix any issues**

If any command failed, fix the issue and re-run. Common issues:
- Lint errors from template code that wasn't cleaned up
- Type errors from missing type annotations
- Prettier formatting differences

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add App smoke test and verify full toolchain"
```

---

## Verification Checklist

After all tasks are complete, verify every acceptance criterion from the spec:

- [ ] `npm run dev` starts a dev server showing the timer page with nav
- [ ] `npm run build` produces a production build without errors
- [ ] `npm run test` runs and passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] All four routes are navigable (/, /history, /training, /settings)
- [ ] Tailwind utility classes work (nav bar is styled, headings have Tailwind classes)
- [ ] cubing and idb are in package.json
