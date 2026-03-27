# Phasewise

A personal speedcubing training tool for desktop web. Connects to Bluetooth smart cubes, tracks solves with automatic CFOP phase segmentation, and identifies OLL/PLL cases — all offline with local storage.

## Features

### Smart Cube Support
- **GAN 356i** via `gan-web-bluetooth`
- **MoYu WRM V10/V11 AI** via custom Bluetooth driver (AES-128 encrypted protocol)
- Unified connection abstraction with battery status reporting
- Requires Chrome or Edge (Web Bluetooth API)

### Solve Tracking
- Automatic scramble generation (3x3, via `cubing.js`)
- Scramble-applied detection — timer starts on first move after scramble
- Full move sequence recording with per-move timestamps
- Solve history persisted in IndexedDB (survives reload, no account needed)

### CFOP Phase Segmentation
- Automatic segmentation into **Cross -> F2L -> OLL -> PLL**
- Per-phase split times and move counts

### Case Recognition
- **All 57 OLL cases** identified and labeled
- **All 21 PLL cases** identified and labeled with AUF normalization
- Deterministic fingerprint-based pattern matching (see ADR-002)
- Cases retroactively applied to existing solves

### Training Tools

**Cross Trainer** — Practice cross solutions with optimal-move comparison via BFS solver. Move-by-move feedback and guidance.

**PLL Trainer** — Drill all 21 PLL algorithms with smart case selection, learning modes, and double-move recognition.

## Quick Start

```bash
git clone <repository-url>
cd cubing-trainer
npm install
npm run dev
```

Open http://localhost:5173 in Chrome or Edge, connect a smart cube via Bluetooth, and start solving.

### Commands

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run test      # Run tests (Vitest)
```

## Tech Stack

- **React 18** + TypeScript (strict mode)
- **Vite** (build tooling)
- **Tailwind CSS 4** (styling)
- **Vitest** (testing)
- **IndexedDB** via `idb` (local persistence)
- **cubing.js** (cube state, scrambles, case recognition)
- **gan-web-bluetooth** (GAN cube BLE driver)
- Custom MoYu BLE driver (ported from cstimer)

## Architecture

```
src/
  app/           App shell, routing, navigation
  features/
    bluetooth/   Smart cube connection (GAN, MoYu, debug UI)
    solve/       Timer, scramble display, solve history
    training/    Training page hub
    pll-trainer/ PLL drill and learn modes
  core/          Framework-agnostic training logic
                 (CFOP segmentation, case recognition, trainers, session state)
  lib/           Thin wrappers (IndexedDB store, scramble generation)
```

Key invariant: all core training logic lives in `src/core/` as framework-agnostic TypeScript. Bluetooth drivers are isolated behind a connection abstraction layer.

## Future Plans

- **Training experience** (Phase 5) — spaced repetition for weak cases, drill mode with app-generated scrambles, analytics/visualization
- **F2L pair recognition** — stretch goal for case identification
- **Additional cube support** — architecture supports adding new brands via the driver abstraction
