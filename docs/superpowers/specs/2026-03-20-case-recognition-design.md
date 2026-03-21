# Phase 4: Case Recognition — Design Spec

## Overview

Recognize which of the 57 OLL and 21 PLL cases occurred in each solve, label them on the solve record, and display them in the UI. F2L pair recognition is deferred to a future phase.

## Approach

**Pattern matching on orientation/permutation vectors.** Each OLL case is defined by the orientation of 8 top-layer pieces (4 corners, 4 edges). Each PLL case is defined by the permutation of those same 8 pieces (orientations are all zero by definition at the PLL stage).

Patterns are generated once from standard algorithms via cubing.js — apply the inverse of a known algorithm to a solved cube, extract the fingerprint — then stored as const data. Verification tests apply the algorithm to the fingerprint state and assert the cube is solved.

This satisfies the project invariant: "Case recognition must be deterministic and based on cubing.js cube state, not heuristics or move-count guesses."

cubing.js (v0.63.3) has no built-in case recognition utilities — KPuzzle provides state management but no pattern classification. An ADR (ADR-002) will be written before implementation documenting this investigation and the chosen approach, per the phase brief.

### Why not full state comparison?

Comparing compact orientation/permutation arrays is faster and simpler than comparing full KPattern states. The fingerprint approach also makes AUF normalization straightforward (rotate the array rather than applying moves).

## Architecture

### Pattern data

Two files of const data:

- `src/core/oll-cases.ts` — 57 entries keyed by case name (e.g., `"OLL 33"`)
- `src/core/pll-cases.ts` — 21 entries keyed by case name (e.g., `"T"`)

Each entry contains corner and edge arrays:

```typescript
export const OLL_CASES: Record<string, { corners: number[]; edges: number[] }> = {
  "OLL 33": { corners: [0, 0, 0, 0], edges: [0, 1, 0, 1] },
  // ...
};

export const PLL_CASES: Record<string, { corners: number[]; edges: number[] }> = {
  "T": { corners: [1, 0, 3, 2], edges: [0, 2, 1, 3] },
  // ...
};
```

### Recognizer functions

Two pure functions in `src/core/case-recognizer.ts`:

- `recognizeOLL(state: KPattern, crossFace: string): string | null`
  - Determines the last layer as the face opposite `crossFace`
  - Uses `buildFaceGeometry` to get piece positions for that face (not hardcoded U-layer indices)
  - Extracts orientations of the 4 corners and 4 edges on the last layer
  - Tests all 4 AUF rotations of the extracted vector
  - Matches against `OLL_CASES`
  - Returns case name or null

- `recognizePLL(state: KPattern, crossFace: string): string | null`
  - Same face-relative extraction as OLL, but reads permutation indices
  - Permutation values are relative within the 4-position subset (0-3), not absolute piece indices (0-7). Position 0 is the piece that belongs there when solved, etc.
  - Tests all 4 AUF rotations of the extracted vector
  - Matches against `PLL_CASES`
  - Returns case name or null

**Cross face handling:** All patterns are defined relative to a canonical orientation (U = last layer). The recognizer extracts pieces using geometry-relative positions from `buildFaceGeometry(oppositeFace)`, so the same patterns work regardless of which face the cross was solved on.

### State snapshots

Two cube states are needed per solve:

1. **State at F2L completion** — orientations are wrong on top layer. This is the OLL case.
2. **State at OLL completion** — orientations are correct, permutation is wrong. This is the PLL case.

`segmentSolve` already replays moves and detects these boundaries. It will be extended to capture the KPattern at each boundary, call the recognizers internally, and include the case labels in the returned `CfopSplits`. This couples segmentation and recognition, but is the simplest approach since both need the same replay.

### Schema extension

```typescript
export interface CfopSplits {
  crossTime?: number;
  f2lTime?: number;
  ollTime?: number;
  crossFace?: string;
  ollCase?: string;   // e.g., "OLL 33"
  pllCase?: string;   // e.g., "T"
}
```

No IndexedDB migration needed — IndexedDB stores arbitrary objects, and the new fields are optional.

### Backfill

`backfillSplits` already re-runs `segmentSolve` on solves missing splits. Extend the condition to also re-process solves that have splits but are missing `ollCase`/`pllCase`. To distinguish "not yet processed" from "processed but unrecognizable," the backfill checks for the absence of `ollCase` only on solves that have `ollTime` set (meaning OLL was detected). Solves without `ollTime` genuinely had no recognizable OLL phase and should not be reprocessed.

### UI

Solve history already shows per-phase split times. Add case names alongside, e.g.:

- "OLL: 1.23s (T)"
- "PLL: 0.89s (Jb)"

Null cases (unrecognized) show time only, no label.

## AUF normalization

Both OLL and PLL states may have any of 4 U-face rotations (AUF) when the phase begins. The same case with different AUF produces different raw fingerprints. Normalization: cyclically rotate the fingerprint array by 0/1/2/3 positions and check each against the canonical pattern. A match at any rotation counts.

Corner and edge arrays must be rotated together (same rotation amount) since they share the same U-face coordinate system.

**Important:** The cyclic order of corners and edges around a face in cubing.js's internal numbering may not be a simple +1 index shift. The rotation mapping must be derived from `buildFaceGeometry` by observing how a U move permutes the piece indices, not assumed. The pattern generation step implicitly handles this correctly (patterns come from actual cube state), but the AUF rotation in the recognizer must use the same empirically-derived cyclic order.

## Pattern generation

A generation script (`scripts/generate-cases.ts` or similar) produces all 78 patterns:

1. Start with a solved 3x3x3 KPuzzle state
2. For each case, apply the inverse of a known algorithm
3. Extract the orientation (OLL) or permutation (PLL) fingerprint
4. Output as TypeScript const data into `oll-cases.ts` and `pll-cases.ts`

The script is run once to produce the data files. Verification tests then independently validate the data (apply algorithm to fingerprint state, assert solved). If patterns ever need regeneration, the script is the source of truth.

Standard algorithms sourced from community references (speedsolving wiki, jperm.net). PLL case names use short names without "-perm" suffix (e.g., `"T"`, `"Jb"`, `"Aa"`) as dictionary keys, with display formatting handled in the UI layer.

## Testing

- **Verification tests (all 78 cases):** For each case, construct the fingerprint state, apply the standard algorithm, assert the cube is solved. This validates that patterns are correct without depending on the generation process.
- **AUF tests:** Apply a U/U2/U' before each test case and verify the same case is still recognized.
- **Integration test:** Run `segmentSolve` on a known solve, verify `ollCase` and `pllCase` are populated.
- **Null case test:** Verify recognizer returns null for a state that doesn't match any case (e.g., mid-F2L state).

## Out of scope

- F2L pair recognition (deferred to future phase)
- ZBLL or other advanced recognition systems
- Non-CFOP methods
- Training UI (that's Phase 5)
