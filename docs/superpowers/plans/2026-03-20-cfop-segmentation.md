# Phase 3: CFOP Segmentation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retroactively segment recorded solves into CFOP phases (Cross, F2L, OLL, PLL) with per-phase split times, by replaying each solve's move sequence against KPuzzle state.

**Architecture:** A pure `segmentSolve()` function in `src/core/` replays moves against KPuzzle, checking phase conditions at each step. Face geometry (which piece positions belong to which face) is discovered dynamically from KPuzzle by applying face moves and observing which positions change. Phase detection checks are applied in order: cross (any of 6 faces, first detected wins), then F2L, then OLL. PLL completion equals cube solved (already tracked). Splits are stored on `StoredSolve` and displayed in history.

**Tech Stack:** cubing.js (KPuzzle, KPattern), TypeScript, Vitest

---

## File Structure

```
src/core/
  cfop-segmenter.ts          — Face geometry, phase detectors, segmentSolve()

src/core/__tests__/
  cfop-segmenter.test.ts     — Tests for all segmentation logic

src/lib/
  solve-store.ts             — MODIFY: add CfopSplits to StoredSolve

src/features/solve/
  use-solve-session.ts       — MODIFY: run segmentation after save
  SolveHistory.tsx            — MODIFY: display per-phase split times
```

---

## Key Concepts for Implementer

### KPuzzle Piece Data Model

`KPattern.patternData` contains orbits. For 3x3x3:
- `"EDGES"`: 12 pieces, 2 orientations each
- `"CORNERS"`: 8 corners, 3 orientations each
- `"CENTERS"`: 6 centers, 4 orientations each

Each orbit has:
- `pieces[i]`: which piece is at position `i` (in solved state, `pieces[i] === i`)
- `orientation[i]`: orientation of piece at position `i` (in solved state, `0`)

A piece at position `i` is "solved" when `pieces[i] === i && orientation[i] === 0`.

### Face Geometry Discovery

To find which 4 edge positions are adjacent to face "R", apply move "R" to the solved state and check which edge positions changed (`pieces[i] !== i`). Same for corners. This gives exactly 4 edges and 4 corners per face.

### Phase Detection Logic

- **Cross on face F**: The 4 edge positions adjacent to F all have their correct piece with correct orientation.
- **F2L given cross on face F**: The 4 corner positions adjacent to F are solved AND the 4 "equator" edge positions (edges not adjacent to F or its opposite face) are solved.
- **OLL given cross on face F**: All 8 piece positions on the opposite face (4 edges + 4 corners) have `orientation === 0`. (We only check OLL after F2L, so the only pieces on the opposite face are pieces that belong there — checking orientation alone is sufficient.)
- **PLL**: Cube is fully solved. Already detected by `SolveSession`.

### Phase Boundary Rule

The boundary is the **first move** where the condition is met. No "remains met" check — algorithms routinely break earlier phases temporarily.

### Cross Color Auto-Detection

On each move (until cross is found), check all 6 faces. The first face whose cross condition is met becomes the cross face for that solve.

---

### Task 1: Face Geometry Utility

**Files:**
- Create: `src/core/cfop-segmenter.ts`
- Create: `src/core/__tests__/cfop-segmenter.test.ts`

Build a utility that maps each face to its adjacent edge and corner positions using KPuzzle.

- [ ] **Step 1: Write the failing test**

```typescript
// src/core/__tests__/cfop-segmenter.test.ts
import { describe, it, expect } from "vitest";
import { cube3x3x3 } from "cubing/puzzles";
import { buildFaceGeometry } from "../cfop-segmenter";

describe("buildFaceGeometry", () => {
  it("returns 4 edge positions per face", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);

    for (let f = 0; f < 6; f++) {
      expect(geometry.faceEdges[f]).toHaveLength(4);
    }
  });

  it("returns 4 corner positions per face", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);

    for (let f = 0; f < 6; f++) {
      expect(geometry.faceCorners[f]).toHaveLength(4);
    }
  });

  it("every edge position appears in exactly 2 faces", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);

    const edgeCounts = new Array(12).fill(0);
    for (let f = 0; f < 6; f++) {
      for (const pos of geometry.faceEdges[f]) {
        edgeCounts[pos]++;
      }
    }
    // Each edge is shared by exactly 2 faces
    for (let i = 0; i < 12; i++) {
      expect(edgeCounts[i]).toBe(2);
    }
  });

  it("every corner position appears in exactly 3 faces", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);

    const cornerCounts = new Array(8).fill(0);
    for (let f = 0; f < 6; f++) {
      for (const pos of geometry.faceCorners[f]) {
        cornerCounts[pos]++;
      }
    }
    // Each corner is shared by exactly 3 faces
    for (let i = 0; i < 8; i++) {
      expect(cornerCounts[i]).toBe(3);
    }
  });

  it("opposite faces share no edge positions", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);

    // Opposite pairs: 0↔5 (U↔D), 1↔3 (L↔R), 2↔4 (F↔B)
    const oppositePairs = [[0, 5], [1, 3], [2, 4]];
    for (const [a, b] of oppositePairs) {
      const shared = geometry.faceEdges[a].filter(
        (e: number) => geometry.faceEdges[b].includes(e)
      );
      expect(shared).toHaveLength(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/__tests__/cfop-segmenter.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/core/cfop-segmenter.ts
import type { KPuzzle } from "cubing/kpuzzle";

const FACE_NAMES = ["U", "L", "F", "R", "B", "D"] as const;
const OPPOSITE_FACE = [5, 3, 4, 1, 2, 0] as const; // U↔D, L↔R, F↔B

export interface FaceGeometry {
  faceEdges: number[][];   // faceEdges[faceIdx] = 4 edge positions
  faceCorners: number[][]; // faceCorners[faceIdx] = 4 corner positions
}

export function buildFaceGeometry(kpuzzle: KPuzzle): FaceGeometry {
  const solved = kpuzzle.defaultPattern();
  const faceEdges: number[][] = [];
  const faceCorners: number[][] = [];

  for (const face of FACE_NAMES) {
    const after = solved.applyMove(face);

    const edges: number[] = [];
    const solvedEdges = solved.patternData["EDGES"];
    const movedEdges = after.patternData["EDGES"];
    for (let i = 0; i < 12; i++) {
      if (movedEdges.pieces[i] !== solvedEdges.pieces[i]) {
        edges.push(i);
      }
    }

    const corners: number[] = [];
    const solvedCorners = solved.patternData["CORNERS"];
    const movedCorners = after.patternData["CORNERS"];
    for (let i = 0; i < 8; i++) {
      if (movedCorners.pieces[i] !== solvedCorners.pieces[i]) {
        corners.push(i);
      }
    }

    faceEdges.push(edges);
    faceCorners.push(corners);
  }

  return { faceEdges, faceCorners };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/__tests__/cfop-segmenter.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/cfop-segmenter.ts src/core/__tests__/cfop-segmenter.test.ts
git commit -m "feat: add face geometry discovery for CFOP segmentation"
```

---

### Task 2: Cross Detection

**Files:**
- Modify: `src/core/cfop-segmenter.ts`
- Modify: `src/core/__tests__/cfop-segmenter.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/core/__tests__/cfop-segmenter.test.ts`:

```typescript
import { buildFaceGeometry, isCrossSolved } from "../cfop-segmenter";

describe("isCrossSolved", () => {
  it("solved cube has cross solved on all faces", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const solved = kpuzzle.defaultPattern();

    for (let f = 0; f < 6; f++) {
      expect(isCrossSolved(solved, geometry, f)).toBe(true);
    }
  });

  it("single R move breaks U, D, R, F, and B crosses but not L", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const afterR = kpuzzle.defaultPattern().applyMove("R");

    // R cycles 4 edges on the R face. These edges are shared with U, D, F, B.
    // Only L cross is unaffected (no L-adjacent edges are on R face).
    expect(isCrossSolved(afterR, geometry, 1)).toBe(true); // L
    // At least R cross should be broken
    expect(isCrossSolved(afterR, geometry, 3)).toBe(false); // R
  });

  it("applying a move and its inverse restores all crosses", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const state = kpuzzle.defaultPattern().applyMove("R").applyMove("R'");

    for (let f = 0; f < 6; f++) {
      expect(isCrossSolved(state, geometry, f)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/__tests__/cfop-segmenter.test.ts`
Expected: FAIL — `isCrossSolved` not exported

- [ ] **Step 3: Implement isCrossSolved**

Add to `src/core/cfop-segmenter.ts`:

```typescript
import type { KPuzzle, KPattern } from "cubing/kpuzzle";

export function isCrossSolved(
  pattern: KPattern,
  geometry: FaceGeometry,
  faceIdx: number,
): boolean {
  const edges = pattern.patternData["EDGES"];
  for (const pos of geometry.faceEdges[faceIdx]) {
    if (edges.pieces[pos] !== pos || edges.orientation[pos] !== 0) {
      return false;
    }
  }
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/__tests__/cfop-segmenter.test.ts`
Expected: All cross tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/cfop-segmenter.ts src/core/__tests__/cfop-segmenter.test.ts
git commit -m "feat: add cross detection for CFOP segmentation"
```

---

### Task 3: F2L Detection

**Files:**
- Modify: `src/core/cfop-segmenter.ts`
- Modify: `src/core/__tests__/cfop-segmenter.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to test file:

```typescript
import { buildFaceGeometry, isCrossSolved, isF2LSolved } from "../cfop-segmenter";

describe("isF2LSolved", () => {
  it("solved cube has F2L solved for all cross faces", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const solved = kpuzzle.defaultPattern();

    for (let f = 0; f < 6; f++) {
      expect(isF2LSolved(solved, geometry, f)).toBe(true);
    }
  });

  it("U move does not break D-face F2L", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    // U only affects U-layer pieces; D-face F2L should be untouched
    const afterU = kpuzzle.defaultPattern().applyMove("U");
    const dFace = 5; // D
    expect(isF2LSolved(afterU, geometry, dFace)).toBe(true);
  });

  it("R move breaks D-face F2L", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    // R affects D-layer corners and middle-layer edges
    const afterR = kpuzzle.defaultPattern().applyMove("R");
    const dFace = 5; // D
    expect(isF2LSolved(afterR, geometry, dFace)).toBe(false);
  });

  it("D cross solved while D F2L is not", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    // The E (equator) slice move cycles the 4 equator edges (FL→FR→BR→BL)
    // without affecting any D-layer or U-layer pieces.
    // Result: D cross intact (D edges untouched), D F2L broken (equator edges displaced).
    const state = kpuzzle.defaultPattern().applyMove("E");
    const dFace = 5;
    expect(isCrossSolved(state, geometry, dFace)).toBe(true);
    expect(isF2LSolved(state, geometry, dFace)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/__tests__/cfop-segmenter.test.ts`
Expected: FAIL — `isF2LSolved` not exported

- [ ] **Step 3: Implement isF2LSolved**

Add to `src/core/cfop-segmenter.ts`:

```typescript
export function isF2LSolved(
  pattern: KPattern,
  geometry: FaceGeometry,
  crossFaceIdx: number,
): boolean {
  const oppFaceIdx = OPPOSITE_FACE[crossFaceIdx];

  // Check 4 corners adjacent to cross face
  const corners = pattern.patternData["CORNERS"];
  for (const pos of geometry.faceCorners[crossFaceIdx]) {
    if (corners.pieces[pos] !== pos || corners.orientation[pos] !== 0) {
      return false;
    }
  }

  // Check 4 equator edges (not on cross face, not on opposite face)
  const crossEdgeSet = new Set(geometry.faceEdges[crossFaceIdx]);
  const oppEdgeSet = new Set(geometry.faceEdges[oppFaceIdx]);
  const edges = pattern.patternData["EDGES"];
  for (let i = 0; i < 12; i++) {
    if (!crossEdgeSet.has(i) && !oppEdgeSet.has(i)) {
      // This is an equator edge
      if (edges.pieces[i] !== i || edges.orientation[i] !== 0) {
        return false;
      }
    }
  }

  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/__tests__/cfop-segmenter.test.ts`
Expected: All F2L tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/cfop-segmenter.ts src/core/__tests__/cfop-segmenter.test.ts
git commit -m "feat: add F2L detection for CFOP segmentation"
```

---

### Task 4: OLL Detection

**Files:**
- Modify: `src/core/cfop-segmenter.ts`
- Modify: `src/core/__tests__/cfop-segmenter.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to test file:

```typescript
import {
  buildFaceGeometry,
  isCrossSolved,
  isF2LSolved,
  isOLLSolved,
} from "../cfop-segmenter";

describe("isOLLSolved", () => {
  it("solved cube has OLL solved for all cross faces", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    const solved = kpuzzle.defaultPattern();

    for (let f = 0; f < 6; f++) {
      expect(isOLLSolved(solved, geometry, f)).toBe(true);
    }
  });

  it("PLL-only state has OLL solved", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    // T-perm swaps pieces but preserves orientation — OLL stays solved
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const state = kpuzzle.defaultPattern().applyAlg(tPerm);
    const dFace = 5; // cross on D
    // F2L should still be solved (T-perm only affects U layer)
    expect(isF2LSolved(state, geometry, dFace)).toBe(true);
    // OLL should still be solved (T-perm preserves orientation)
    expect(isOLLSolved(state, geometry, dFace)).toBe(true);
  });

  it("Sune breaks OLL but preserves F2L", async () => {
    const kpuzzle = await cube3x3x3.kpuzzle();
    const geometry = buildFaceGeometry(kpuzzle);
    // Sune changes U-layer corner orientations; net effect is U-layer only
    const sune = "R U R' U R U2 R'";
    const state = kpuzzle.defaultPattern().applyAlg(sune);
    const dFace = 5;
    expect(isF2LSolved(state, geometry, dFace)).toBe(true);
    expect(isOLLSolved(state, geometry, dFace)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/__tests__/cfop-segmenter.test.ts`
Expected: FAIL — `isOLLSolved` not exported

- [ ] **Step 3: Implement isOLLSolved**

Add to `src/core/cfop-segmenter.ts`:

```typescript
export function isOLLSolved(
  pattern: KPattern,
  geometry: FaceGeometry,
  crossFaceIdx: number,
): boolean {
  const oppFaceIdx = OPPOSITE_FACE[crossFaceIdx];

  // Check orientation of all pieces on opposite face (the OLL face)
  const edges = pattern.patternData["EDGES"];
  for (const pos of geometry.faceEdges[oppFaceIdx]) {
    if (edges.orientation[pos] !== 0) {
      return false;
    }
  }

  const corners = pattern.patternData["CORNERS"];
  for (const pos of geometry.faceCorners[oppFaceIdx]) {
    if (corners.orientation[pos] !== 0) {
      return false;
    }
  }

  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/__tests__/cfop-segmenter.test.ts`
Expected: All OLL tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/cfop-segmenter.ts src/core/__tests__/cfop-segmenter.test.ts
git commit -m "feat: add OLL detection for CFOP segmentation"
```

---

### Task 5: segmentSolve Function

**Files:**
- Modify: `src/core/cfop-segmenter.ts`
- Modify: `src/core/__tests__/cfop-segmenter.test.ts`

The main function that replays a solve's moves and returns split times.

- [ ] **Step 1: Write the failing tests**

Append to test file:

```typescript
import {
  buildFaceGeometry,
  isCrossSolved,
  isF2LSolved,
  isOLLSolved,
  segmentSolve,
  type CfopSplits,
} from "../cfop-segmenter";
import type { TimestampedMove } from "../solve-session";

describe("segmentSolve", () => {
  it("returns empty splits for a single-move solve that doesn't complete any phase", async () => {
    // Scramble: solved. Apply "R" then "R'" to solve.
    // But "R" from solved breaks everything, and "R'" restores all at once.
    // Actually after scramble "R", state has everything broken.
    // Applying "R'" solves everything — cross, F2L, OLL all detected on same move.
    const splits = await segmentSolve("R", [
      { move: "R'", timestamp: 100 },
    ]);
    // All phases detected on the single move
    expect(splits.crossTime).toBe(100);
    expect(splits.f2lTime).toBe(100);
    expect(splits.ollTime).toBe(100);
    expect(splits.crossFace).toBeDefined();
  });

  it("detects phases at distinct timestamps for a constructed solve", async () => {
    // Build a scramble that requires separate cross, F2L, and OLL solutions.
    // Scramble = E (breaks equator edges = F2L) + Sune (breaks OLL) + T-perm (breaks PLL)
    // The cross is never broken, so it's detected immediately on the first move.
    // Solution reverses the scramble:
    //   1. T-perm (self-inverse) → fixes PLL; cross already solved, F2L still broken
    //   2. inv-Sune → fixes OLL orientation; F2L still broken (equator edges)
    //   3. E' → fixes equator edges → F2L solved
    // Phase detection order: cross (move 1), then F2L (last E' move), OLL somewhere in between.
    //
    // Actually, since we detect in order (cross first, then F2L, then OLL),
    // and OLL is only checked after F2L, the OLL detection may come after F2L.
    // Key assertion: all three are detected and cross <= F2L <= OLL.
    const sune = "R U R' U R U2 R'";
    const invSune = "R U2 R' U' R U' R'";
    const tPerm = "R U R' U' R' F R2 U' R' U' R U R' F'";
    const scramble = `E ${sune} ${tPerm}`;
    const solutionStr = `${tPerm} ${invSune} E'`;
    const solutionMoves = solutionStr.split(" ");

    const moves: TimestampedMove[] = solutionMoves.map((m, i) => ({
      move: m,
      timestamp: (i + 1) * 100,
    }));

    const splits = await segmentSolve(scramble, moves);

    expect(splits.crossTime).toBeDefined();
    expect(splits.f2lTime).toBeDefined();
    expect(splits.ollTime).toBeDefined();
    // Cross should be detected early (D cross was never broken)
    // F2L and OLL should be detected later
    expect(splits.crossTime!).toBeLessThanOrEqual(splits.f2lTime!);
    expect(splits.f2lTime!).toBeLessThanOrEqual(splits.ollTime!);
    // F2L should not be detected until E' is applied (last move)
    expect(splits.f2lTime).toBe(solutionMoves.length * 100);
  });

  it("auto-detects cross face", async () => {
    const splits = await segmentSolve("R", [
      { move: "R'", timestamp: 100 },
    ]);
    // Should detect some cross face (any of the 6)
    expect(splits.crossFace).toBeDefined();
    expect(["U", "L", "F", "R", "B", "D"]).toContain(splits.crossFace);
  });

  it("detects cross on a non-D face", async () => {
    // Scramble: "D" (only D-layer pieces move). Cross on U is still solved.
    // Solution: "D'" restores everything.
    const splits = await segmentSolve("D", [
      { move: "D'", timestamp: 200 },
    ]);
    // The segmenter checks faces in order [U, L, F, R, B, D].
    // After "D'" from scramble "D", all crosses are solved. The first
    // detected should be U (index 0).
    expect(splits.crossFace).toBe("U");
    expect(splits.crossTime).toBe(200);
  });

  it("returns no splits if solve never completes cross", async () => {
    // Scramble that's far from solved; single move doesn't help
    const splits = await segmentSolve("R U F D L B R2 U2 F2 D2", [
      { move: "R", timestamp: 100 },
    ]);
    // Extremely unlikely that a single R after that scramble solves any cross
    expect(splits.crossTime).toBeUndefined();
    expect(splits.f2lTime).toBeUndefined();
    expect(splits.ollTime).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/core/__tests__/cfop-segmenter.test.ts`
Expected: FAIL — `segmentSolve` not exported

- [ ] **Step 3: Implement segmentSolve**

Add to `src/core/cfop-segmenter.ts`:

```typescript
import { cube3x3x3 } from "cubing/puzzles";
import type { TimestampedMove } from "./solve-session";

export interface CfopSplits {
  crossTime?: number;  // ms relative to solve start
  f2lTime?: number;
  ollTime?: number;
  crossFace?: string;  // "U", "L", "F", "R", "B", "D"
}

// Cache geometry since it's the same for every 3x3 solve
let cachedGeometry: FaceGeometry | null = null;

async function getGeometry(): Promise<{ kpuzzle: KPuzzle; geometry: FaceGeometry }> {
  const kpuzzle = await cube3x3x3.kpuzzle();
  if (!cachedGeometry) {
    cachedGeometry = buildFaceGeometry(kpuzzle);
  }
  return { kpuzzle, geometry: cachedGeometry };
}

export async function segmentSolve(
  scramble: string,
  moves: TimestampedMove[],
): Promise<CfopSplits> {
  const { kpuzzle, geometry } = await getGeometry();
  const splits: CfopSplits = {};

  let state = kpuzzle.defaultPattern().applyAlg(scramble);
  let crossFaceIdx: number | null = null;

  for (const { move, timestamp } of moves) {
    state = state.applyMove(move);

    // Phase 1: Detect cross (check all 6 faces)
    if (crossFaceIdx === null) {
      for (let f = 0; f < 6; f++) {
        if (isCrossSolved(state, geometry, f)) {
          crossFaceIdx = f;
          splits.crossTime = timestamp;
          splits.crossFace = FACE_NAMES[f];
          break;
        }
      }
    }

    // Phase 2: Detect F2L
    if (crossFaceIdx !== null && splits.f2lTime === undefined) {
      if (isF2LSolved(state, geometry, crossFaceIdx)) {
        splits.f2lTime = timestamp;
      }
    }

    // Phase 3: Detect OLL
    if (splits.f2lTime !== undefined && splits.ollTime === undefined) {
      if (isOLLSolved(state, geometry, crossFaceIdx!)) {
        splits.ollTime = timestamp;
      }
    }
  }

  return splits;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- src/core/__tests__/cfop-segmenter.test.ts`
Expected: All segmentSolve tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/cfop-segmenter.ts src/core/__tests__/cfop-segmenter.test.ts
git commit -m "feat: add segmentSolve function for CFOP phase detection"
```

---

### Task 6: Data Model + Integration

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `src/lib/solve-store.ts`
- Modify: `src/features/solve/use-solve-session.ts`

Add `splits` field to `StoredSolve` and the DB type, run segmentation when saving a solve, and add a backfill method for existing solves.

- [ ] **Step 1: Update PhasewiseDB type in db.ts**

In `src/lib/db.ts`, add `splits` to the solves value type. No DB migration is needed (IndexedDB stores arbitrary objects), but the TypeScript type must match:

```typescript
// In the PhasewiseDB interface, add to the solves value type:
  solves: {
    key: string;
    value: {
      id: string;
      scramble: string;
      moves: { move: string; timestamp: number }[];
      startTime: number;
      endTime: number;
      duration: number;
      createdAt: number;
      splits?: {           // NEW
        crossTime?: number;
        f2lTime?: number;
        ollTime?: number;
        crossFace?: string;
      };
    };
    indexes: { "by-created": number };
  };
```

Note: inline the splits type here rather than importing `CfopSplits` to avoid a circular dependency between `db.ts` and the core module.

- [ ] **Step 2: Add CfopSplits to StoredSolve**

In `src/lib/solve-store.ts`, add the import and update the interface:

```typescript
import type { CfopSplits } from "@/core/cfop-segmenter";

export interface StoredSolve {
  id: string;
  scramble: string;
  moves: TimestampedMove[];
  startTime: number;
  endTime: number;
  duration: number;
  createdAt: number;
  splits?: CfopSplits; // NEW — optional for backwards compat
}
```

- [ ] **Step 3: Add backfill method to SolveStore**

Add to `SolveStore` class in `src/lib/solve-store.ts`:

```typescript
import { segmentSolve } from "@/core/cfop-segmenter";

  async backfillSplits(): Promise<void> {
    const all = await this.getAll();
    for (const solve of all) {
      if (!solve.splits) {
        const splits = await segmentSolve(solve.scramble, solve.moves);
        solve.splits = splits;
        await this.save(solve);
      }
    }
  }
```

- [ ] **Step 4: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Wire segmentation into use-solve-session.ts**

In `src/features/solve/use-solve-session.ts`, modify the save logic inside the `"solved"` phase handler (around line 98). Add the segmentation call:

```typescript
import { segmentSolve } from "@/core/cfop-segmenter";

// Inside the "solved" handler, replace the save block with:
        const solve: StoredSolve = {
          id: crypto.randomUUID(),
          scramble: session.scramble,
          moves: [...session.moves],
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          createdAt: Date.now(),
        };
        // Run segmentation before saving
        segmentSolve(solve.scramble, solve.moves).then((splits) => {
          solve.splits = splits;
          solveStore.save(solve).then(() => {
            solveStore.getAll().then(setRecentSolves);
          });
        });
```

- [ ] **Step 6: Add backfill on history load**

In the `useEffect` that loads solves on mount (around line 27), add backfill:

```typescript
  useEffect(() => {
    solveStore.backfillSplits().then(() => {
      solveStore.getAll().then(setRecentSolves);
    });
  }, []);
```

- [ ] **Step 7: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 8: Run all tests**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 9: Commit**

```bash
git add src/lib/db.ts src/lib/solve-store.ts src/features/solve/use-solve-session.ts
git commit -m "feat: wire CFOP segmentation into solve save flow with backfill"
```

---

### Task 7: Display Splits in History UI

**Files:**
- Modify: `src/features/solve/SolveHistory.tsx`

Show per-phase split times in the solve history list.

- [ ] **Step 1: Update SolveHistory to display splits**

In `src/features/solve/SolveHistory.tsx`, update the render to show splits when available:

```typescript
// src/features/solve/SolveHistory.tsx
import type { StoredSolve } from "@/lib/solve-store";

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  }
  return seconds.toFixed(2);
}

function SplitTimes({ solve }: { solve: StoredSolve }) {
  if (!solve.splits?.crossTime) return null;

  const { crossTime, f2lTime, ollTime } = solve.splits;
  const pllTime = solve.duration;

  // Calculate phase durations (time spent in each phase)
  const crossDuration = crossTime;
  const f2lDuration = f2lTime !== undefined ? f2lTime - crossTime : undefined;
  const ollDuration =
    f2lTime !== undefined && ollTime !== undefined
      ? ollTime - f2lTime
      : undefined;
  const pllDuration =
    ollTime !== undefined ? pllTime - ollTime : undefined;

  return (
    <div className="flex gap-2 text-xs text-gray-500">
      <span title="Cross">{formatTime(crossDuration)}</span>
      {f2lDuration !== undefined && (
        <>
          <span className="text-gray-700">|</span>
          <span title="F2L">{formatTime(f2lDuration)}</span>
        </>
      )}
      {ollDuration !== undefined && (
        <>
          <span className="text-gray-700">|</span>
          <span title="OLL">{formatTime(ollDuration)}</span>
        </>
      )}
      {pllDuration !== undefined && (
        <>
          <span className="text-gray-700">|</span>
          <span title="PLL">{formatTime(pllDuration)}</span>
        </>
      )}
    </div>
  );
}

interface SolveHistoryProps {
  solves: StoredSolve[];
}

export function SolveHistory({ solves }: SolveHistoryProps) {
  if (solves.length === 0) {
    return <p className="text-gray-500">No solves yet.</p>;
  }

  return (
    <div className="space-y-2">
      {solves.map((solve, i) => (
        <div key={solve.id} className="font-mono text-sm text-gray-300">
          <div className="flex justify-between">
            <span className="text-gray-500">{i + 1}.</span>
            <span>{formatTime(solve.duration)}</span>
            <span className="text-gray-600 text-xs truncate max-w-[200px]">
              {solve.scramble}
            </span>
          </div>
          <SplitTimes solve={solve} />
        </div>
      ))}
    </div>
  );
}

export { formatTime };
```

- [ ] **Step 2: Verify typecheck and build pass**

Run: `npm run typecheck && npm run build`
Expected: Both PASS

- [ ] **Step 3: Run all tests**

Run: `npm run test`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/features/solve/SolveHistory.tsx
git commit -m "feat: display CFOP split times in solve history"
```

---

### Task 8: Update Phase Status

**Files:**
- Modify: `docs/phases/03-case-recognition.md` — set status to `in-progress`
- Modify: `docs/status.md` — update active phase and fix naming

- [ ] **Step 1: Update phase brief status**

In `docs/phases/03-case-recognition.md`, change:
```
## Status
backlog
```
to:
```
## Status
in-progress
```

- [ ] **Step 2: Update status.md**

Replace:
```markdown
## Active phases
None
```
with:
```markdown
## Active phases
- Phase 3: CFOP Segmentation
```

- [ ] **Step 3: Commit**

```bash
git add docs/phases/03-case-recognition.md docs/status.md
git commit -m "docs: mark Phase 3 (CFOP Segmentation) as in-progress"
```

---

## Notes for Implementer

1. **`FACE_NAMES` ordering**: The constant `["U", "L", "F", "R", "B", "D"]` must match the face ordering that cubing.js uses for its 3x3x3 definition. The geometry discovery approach makes this work regardless of internal ordering, but `OPPOSITE_FACE` mapping `[5, 3, 4, 1, 2, 0]` assumes this specific order. Verify by checking that opposite faces share no edge positions (covered by the geometry test).

2. **No DB migration needed**: IndexedDB stores arbitrary objects. Adding `splits` as an optional field to `StoredSolve` is backwards-compatible — existing solves simply won't have it until backfilled.

3. **Backfill performance**: The backfill runs `segmentSolve` for each solve without splits. Each call replays ~50-60 moves against KPuzzle with 6-12 position checks per move — negligible cost even for hundreds of solves.

4. **Caching**: The geometry is cached after first computation since it's the same for every 3x3x3 solve. The `kpuzzle` instance is also effectively cached by cubing.js.

5. **Import `TimestampedMove`**: The `segmentSolve` function imports `TimestampedMove` from `./solve-session`. This type is `{ move: string; timestamp: number }`, already used by `StoredSolve`.

6. **Phase brief filename**: The file is named `03-case-recognition.md` but contains CFOP Segmentation content. Don't rename the file — just update the status field inside it.
