# cubing.js search worker fails on iOS WKWebView (Bluefy)

**Date:** 2026-03-28
**Status:** Workaround in place, not fully resolved
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
- **Current approach:** Injecting a Proxy-based DOM shim into the preload-helper chunk (the first module the worker loads). The shim provides no-op stubs for `document`, `HTMLElement`, `customElements`, `CSSStyleSheet`, `window`, `localStorage`, and `navigator`. Uses `Object.defineProperty` with try/catch to handle non-configurable globals in strict mode. **Status: in testing, not yet confirmed working.**

## Current workaround

`src/lib/scramble.ts` has a fallback system:
1. Detect module worker support (`supportsModuleWorkers()`)
2. Race `randomScrambleForEvent()` against an 8s timeout (first attempt) or 3s (subsequent)
3. If the worker never succeeds, mark it as broken in `localStorage` and use random-move scrambles instantly for all future calls
4. Random-move scrambles are not random-state (not uniformly distributed over all cube states) but are fine for practice

## Impact

- **Scrambles:** Random-move fallback works. Users get usable scrambles instantly after the first session.
- **Solver (future):** No workaround exists. Features like optimal cross solution display, solve reconstruction review, and case identification that need the solver will not work on Bluefy until this is resolved.
- **Desktop Chrome:** Unaffected. The worker works fine.
- **Capacitor (future):** Likely unaffected. Capacitor uses the system WKWebView which is updated with iOS. iOS 15+ supports module workers. The key difference is that Capacitor's WKWebView is more modern than Bluefy's, and Capacitor apps typically serve content from `capacitor://localhost` which may have different security policies.

## What would fix this properly

1. **cubing.js:** Separate solver/puzzle code from twisty player UI code at the package level so they end up in different chunks. The search worker should never need to import modules that reference DOM globals. This is a bundling/architecture issue in cubing.js.
2. **Vite:** Better worker chunk isolation — worker bundles should not share chunks with the main thread bundle, or at minimum should tree-shake DOM references from worker-loaded chunks.
3. **Our DOM shim approach:** If confirmed working, this is a viable long-term workaround that doesn't require upstream changes. The shim makes all DOM APIs no-op in the worker context, allowing module evaluation to succeed. The solver code paths never actually call DOM APIs, so the stubs are never exercised beyond initialization.

## Reproduction

1. Deploy to GitHub Pages with `base: "/cubing-trainer/"`
2. Open in Bluefy on iOS
3. Connect a cube and observe scrambles — they'll use the random-move fallback after an 8s timeout
4. The "Test Worker" diagnostic button on the solve page tests individual chunk imports in a worker and reports which one fails
