# cubing.js search worker fails on iOS WKWebView (Bluefy)

**Date:** 2026-03-28
**Status:** Resolved (2026-03-28)
**Affects:** `cubing/scramble` (`randomScrambleForEvent`), and any future use of `cubing/search` (solver)

## Summary

The cubing.js search worker hangs silently on iOS when accessed through Bluefy (a Web Bluetooth browser that uses WKWebView). The worker never posts the `"comlink-exposed"` message back, so `randomScrambleForEvent()` returns a promise that never resolves. This blocks random-state scramble generation and will block any future solver usage (e.g., optimal cross solutions, solve review).

## Root cause

Vite bundles cubing.js's solver code (puzzles, alg, kpuzzle — all DOM-free) into the same chunks as cubing.js's twisty player UI code (custom elements, `document.createElement`, `customElements.define`, etc.). When the search worker imports these shared chunks, the DOM references execute at module evaluation time and crash because workers have no DOM.

On desktop Chrome this is tolerated — Chrome's module worker implementation appears lenient about DOM references that exist in imported modules but aren't executed on the active code path. iOS WKWebView (as used by Bluefy) is stricter and throws `ReferenceError: Can't find variable: document` during module evaluation.

## Specific issues found (in order of discovery)

### 1. Characteristic UUID case sensitivity
**File:** `moyu-bluetooth-connection.ts`
Bluefy returns BLE characteristic UUIDs in uppercase. The code compared with lowercase constants using `===`.
**Fix:** `.toLowerCase()` on UUID comparison. *(Committed)*

### 2. `writeValueWithoutResponse` not supported
**File:** `moyu-bluetooth-connection.ts`
Bluefy may not support `writeValueWithoutResponse` on BLE characteristics.
**Fix:** Check `properties.writeWithoutResponse` and fall back to `writeValue`. *(Committed)*

### 3. Notifications need settling time
**File:** `moyu-bluetooth-connection.ts`
`startNotifications()` needs a brief delay before writing requests on some iOS BLE stacks.
**Fix:** 200ms delay after `startNotifications()`. *(Committed)*

### 4. cubing.js module worker hangs — Vite `worker.format`
**File:** `vite.config.ts`
cubing.js requires `worker: { format: "es" }` in Vite config. Without it, Vite defaults to `iife` which breaks the worker's code splitting.
**Fix:** Added config. *(Committed, but insufficient on its own)*

### 5. Vite inline modulepreload polyfill crashes in worker
**File:** Built `index-*.js`
Vite injects a modulepreload polyfill at the top of the index chunk: `(function(){const t=document.createElement("link").relList;...})()`. This executes at the module's top level and crashes in workers.
**Fix:** `build.modulePreload: { polyfill: false }`. *(Committed)*

### 6. `localStorage` referenced at module top level
**File:** `scramble.ts`
Our own `localStorage.getItem/removeItem` calls at module scope crash in workers (workers don't have `localStorage`).
**Fix:** Wrapped in try/catch. *(Committed)*

### 7. cubing.js twisty player DOM code in shared chunks (the real problem)
**Files:** Built `index-*.js` chunks
Vite merges cubing.js's DOM-free code (KPuzzle, Alg, Move, solver internals) with DOM-dependent code (twisty player custom elements) into a single shared chunk. The twisty player code does things like:
- `customElements.define("twisty-player", ...)` at top level
- Class field initializers: `htmlButton = document.createElement("button")`
- `attachShadow()`, `document.createElement()`, etc.

These all execute during module evaluation and crash in workers on iOS WKWebView.

**Attempted fixes:**
- `manualChunks` to split React out — partially worked but cubing.js chunks still contained DOM code
- `manualChunks` to split `cubing/twisty` — backfired because Vite put shared symbols (KPuzzle, etc.) into the twisty chunk
- `manualChunks` to put all of cubing.js in one chunk — broke dynamic imports entirely
- Patching worker entry to remove main bundle import — insufficient, `inside` chunk still imports DOM-laden index
- Stripping bare `import"./react-vendor-*.js"` from worker chunks — only removed side-effect imports, not named imports
- Guarding `document` references in preload helper — fixed that file but not the index chunk
- DOM shim injection into preload-helper — failed on iOS WKWebView with "Attempted to assign to readonly property" when trying to redefine `window` on globalThis
- Adding `!(n in globalThis)` guard to shim — fixed the readonly error but React still crashed (error #299) because the `inside` chunk imported the index chunk
- **Solution: `manualChunks` chunk separation.** Put all cubing.js non-twisty modules into a `cubing-core` chunk via Rollup's `manualChunks`. The search worker's dependency chain becomes `search-worker-entry → cubing-core → inside`, never loading the index chunk (which contains React + twisty player DOM code). cubing.js's own code already guards DOM access with `globalThis.HTMLElement ? ... : fallback` patterns, so no DOM shim is needed. A small Vite plugin still guards Vite's modulepreload helper with `typeof document` checks. **Confirmed working on Bluefy/iOS WKWebView.**

## Fallback (still in place)

`src/lib/scramble.ts` retains the fallback system as defense-in-depth:
1. Detect module worker support (`supportsModuleWorkers()`)
2. Race `randomScrambleForEvent()` against an 8s timeout (first attempt) or 3s (subsequent)
3. If the worker never succeeds, mark it as broken in `localStorage` and use random-move scrambles instantly for all future calls
4. Random-move scrambles are not random-state (not uniformly distributed over all cube states) but are fine for practice

## Impact (post-fix)

- **Scrambles:** Random-state scrambles now work on Bluefy via the cubing.js worker.
- **Solver (future):** Should also work, since the solver uses the same worker/chunk path. Needs testing when solver features are implemented.
- **Desktop Chrome:** Unaffected. The worker continues to work fine.

## Key insight

The fix was a bundling strategy change, not a runtime patch. By controlling which code ends up in which chunk via `manualChunks`, we ensure the worker never loads React or twisty player DOM code. This is more robust than trying to shim DOM APIs at runtime.
