# Any Cross Face Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix `segmentSolve` to detect the cross on any face (not just D) by using F2L completion to confirm which face is the real cross face.

**Architecture:** Track cross completion across all 6 faces simultaneously during replay. Don't commit to a cross face until F2L is detected — the first face where both cross and F2L are solved is the real cross face. This eliminates false positives from intermediate states where a non-target face transiently has its cross solved. Fall back to earliest cross with D preference if F2L is never reached. The case recognizer already handles any cross face via `alignToU` rotation — it just needs test coverage.

**Tech Stack:** TypeScript, Vitest, cubing.js (KPuzzle/KPattern)

---

## File Map

- **Modify:** `src/core/cfop-segmenter.ts:137-191` — rewrite `segmentSolve` loop
- **Modify:** `src/core/__tests__/cfop-segmenter.test.ts` — replace D-only tests, add multi-face and fallback tests
- **Modify:** `src/core/__tests__/case-recognizer.test.ts` — add non-D cross face recognition tests

No changes needed to `case-recognizer.ts`, `oll-cases.ts`, `pll-cases.ts`, or any UI files.

---

### Task 1: Rewrite segmentSolve with multi-face tracking

**Files:**
- Modify: `src/core/cfop-segmenter.ts:137-191`

- [ ] **Step 1: Replace the `segmentSolve` function**

Replace the entire function body. Key changes from the current code:
- Track cross completion on all 6 faces via `crossTimes` array
- Cross face is confirmed only when F2L is detected on a face that already has cross
- Check D first for tiebreaking when multiple faces qualify simultaneously
- Remove the standalone "Phase 2: Detect F2L" block — it's now handled inside the cross confirmation logic
- Fallback: if F2L is never reached, use earliest cross with D preference

```typescript
const F2L_CHECK_ORDER = [5, 0, 1, 2, 3, 4] as const; // D first for tiebreaking

export async function segmentSolve(
  scramble: string,
  moves: TimestampedMove[],
): Promise<CfopSplits> {
  try {
    const { kpuzzle, geometry } = await getGeometry();
    const splits: CfopSplits = {};

    let state = kpuzzle.defaultPattern().applyAlg(scramble);
    let crossFaceIdx: number | null = null;
    const crossTimes: (number | null)[] = [null, null, null, null, null, null];
    let f2lState: KPattern | null = null;
    let ollState: KPattern | null = null;

    for (const { move, timestamp } of moves) {
      state = state.applyMove(move);

      if (crossFaceIdx === null) {
        // Track cross completion on all 6 faces
        for (let f = 0; f < 6; f++) {
          if (crossTimes[f] === null && isCrossSolved(state, geometry, f)) {
            crossTimes[f] = timestamp;
          }
        }

        // Confirm cross face via F2L detection (check D first for tiebreaking)
        for (const f of F2L_CHECK_ORDER) {
          if (crossTimes[f] !== null && isF2LSolved(state, geometry, f)) {
            crossFaceIdx = f;
            splits.crossTime = crossTimes[f]!;
            splits.crossFace = FACE_NAMES[f];
            splits.f2lTime = timestamp;
            f2lState = state;
            break;
          }
        }
      }

      // Detect OLL (only after F2L is confirmed)
      if (splits.f2lTime !== undefined && splits.ollTime === undefined) {
        if (isOLLSolved(state, geometry, crossFaceIdx!)) {
          splits.ollTime = timestamp;
          ollState = state;
        }
      }
    }

    // Fallback: if F2L was never detected, use earliest cross (prefer D)
    if (crossFaceIdx === null) {
      let earliest: number | null = null;
      for (const f of F2L_CHECK_ORDER) {
        const t = crossTimes[f];
        if (t !== null && (earliest === null || t < earliest)) {
          earliest = t;
          crossFaceIdx = f;
        }
      }
      if (crossFaceIdx !== null) {
        splits.crossTime = earliest!;
        splits.crossFace = FACE_NAMES[crossFaceIdx];
      }
    }

    if (f2lState && splits.crossFace) {
      splits.ollCase = await recognizeOLL(f2lState, splits.crossFace) ?? undefined;
    }
    if (ollState && splits.crossFace) {
      splits.pllCase = await recognizePLL(ollState, splits.crossFace) ?? undefined;
    }

    return splits;
  } catch {
    return {};
  }
}
```

Note on the fallback tiebreaker: `F2L_CHECK_ORDER` starts with D (index 5). The loop picks the first face with the smallest timestamp. Since D is checked first, equal timestamps → D wins.

- [ ] **Step 2: Run existing tests to check for regressions**

Run: `npm run test -- --run`
Expected: Existing tests should mostly pass. The test "always reports D as cross face" will still pass since `R`/`R'` solves everything simultaneously and D wins the tiebreak. Other tests should be unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/core/cfop-segmenter.ts
git commit -m "feat: detect cross on any face using F2L confirmation"
```

---

### Task 2: Update segmenter tests for any-face behavior

**Files:**
- Modify: `src/core/__tests__/cfop-segmenter.test.ts`

- [ ] **Step 1: Replace the "always reports D" test with a non-D cross test**

Remove the test at ~line 232 (`"always reports D as cross face"`). Replace with a test using a verified scramble/solution where U cross is confirmed before D cross.

**Verified test case:** Scramble `"D U R"`, solution `"R' U' D'"`.
- After `R'` (t=100): state = solved+D+U. No cross solved on any face.
- After `U'` (t=200): state = solved+D. U cross solved, D cross NOT solved. U F2L solved (D move doesn't affect U corners or equator edges). → Segmenter confirms U as cross face.
- After `D'` (t=300): fully solved.

```typescript
it("detects cross on U face when D cross is not yet solved at F2L confirmation", async () => {
  const splits = await segmentSolve("D U R", [
    { move: "R'", timestamp: 100 },
    { move: "U'", timestamp: 200 },
    { move: "D'", timestamp: 300 },
  ]);
  expect(splits.crossFace).toBe("U");
  expect(splits.crossTime).toBe(200);
  expect(splits.f2lTime).toBe(200);
});
```

- [ ] **Step 2: Add D-preference tiebreaker test**

When all faces solve simultaneously (single-move solve), D should be preferred.

```typescript
it("prefers D when multiple faces have cross and F2L at same time", async () => {
  const splits = await segmentSolve("R", [
    { move: "R'", timestamp: 100 },
  ]);
  expect(splits.crossFace).toBe("D");
  expect(splits.crossTime).toBe(100);
});
```

- [ ] **Step 3: Add fallback test (F2L never reached)**

When the solve never completes F2L, the segmenter should fall back to the earliest detected cross. Scramble `"E R"`: E displaces equator edges, R breaks more. Solution `"R'"` undoes R → state = solved+E. Both D and U crosses are solved (E doesn't affect D or U edges), but F2L is broken for all faces (equator edges displaced). D preferred in fallback.

```typescript
it("falls back to earliest cross with D preference when F2L is never reached", async () => {
  const splits = await segmentSolve("E R", [
    { move: "R'", timestamp: 100 },
  ]);
  expect(splits.crossFace).toBe("D");
  expect(splits.crossTime).toBe(100);
  expect(splits.f2lTime).toBeUndefined();
});
```

- [ ] **Step 4: Run tests**

Run: `npm run test -- --run`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/__tests__/cfop-segmenter.test.ts
git commit -m "test: update segmenter tests for any-face cross detection"
```

---

### Task 3: Add non-D cross face tests for the case recognizer

**Files:**
- Modify: `src/core/__tests__/case-recognizer.test.ts`

The `alignToU` rotation logic in `case-recognizer.ts` supports any cross face but all tests pass `"D"`. These tests exercise the rotation path.

**Key insight for constructing test states:** `recognizeOLL(state, "U")` internally applies `x2` to align D→U before matching. So to create a state that the recognizer will match as OLL 27 with cross on U, we need `state.applyAlg("x2")` to equal the standard OLL 27 state. Since x2 is self-inverse: `state = standardOLL27State.applyAlg("x2")`.

- [ ] **Step 1: Write OLL recognition test with U cross**

```typescript
it("recognizes OLL with cross on U (OLL face is D)", async () => {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();
  // Standard OLL 27 state (for D cross / U OLL face)
  const inverseAlg = new Alg(OLL_CASES["OLL 27"].algorithm).invert();
  const standardOllState = solved.applyAlg(inverseAlg);
  // Apply x2 so that after the recognizer's x2 alignment, it sees the standard state
  const ollState = standardOllState.applyAlg("x2");
  const result = await recognizeOLL(ollState, "U");
  expect(result).toBe("OLL 27");
});
```

- [ ] **Step 2: Write PLL recognition test with U cross**

```typescript
it("recognizes PLL with cross on U (PLL face is D)", async () => {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();
  const inverseAlg = new Alg(PLL_CASES["T"].algorithm).invert();
  const standardPllState = solved.applyAlg(inverseAlg);
  const pllState = standardPllState.applyAlg("x2");
  const result = await recognizePLL(pllState, "U");
  expect(result).toBe("T");
});
```

- [ ] **Step 3: Run tests**

Run: `npm run test -- --run`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add src/core/__tests__/case-recognizer.test.ts
git commit -m "test: add non-D cross face tests for OLL/PLL recognition"
```

---

### Task 4: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npm run test -- --run`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors
