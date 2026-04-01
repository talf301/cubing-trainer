# F2L Recognition Spike — Design Spec

**Date:** 2026-03-31
**Type:** Spike (time-boxed research + proof of concept)
**Depends on:** cfop-phase-detection (done)
**Parent:** f2l-training epic

## Goal

Prove that F2L pair case recognition works using a normalized-tuple fingerprint approach. Recognize all 41 standard F2L cases across all 4 slots during live solve replay, including handling non-standard states (pieces in wrong slots).

## Design Decisions

- **Live replay recognition** — identify what case the user faced at each pair insertion during solve replay (not a standalone trainer)
- **Full 41-case granularity** — exact case identification, not grouped categories
- **Continuous 4-slot tracking** — monitor all slots every move, detect transitions
- **All states handled** — pieces in wrong slots produce a valid tuple but won't match a standard case
- **Algorithm only** — no DB, UI, or segmenter integration; proof of concept

## Approach: Hybrid Normalized State Fingerprint

Combines fingerprint matching (consistent with ADR-002) with programmatic table generation. For each slot, compute a compact normalized state tuple from piece positions, then look it up in a table generated from the 41 canonical algorithms.

## Slot Model

4 F2L slots, each defined by a corner-edge pair that belongs there when solved. For a D-face cross these are FR, FL, BR, BL — but since we support any cross face, slot definitions are derived from `FaceGeometry`.

Each slot is one of the 4 cross-face corners paired with its corresponding equator edge. The pairing: a cross-face corner and an equator edge share exactly two non-cross, non-opposite faces — those shared faces define the slot.

**Slot tracking:** Monitor all 4 slots each move. A slot is "solved" when both its corner and edge are in their home positions with orientation 0 (same check as `isF2LSolved`, but per-slot). When a slot transitions unsolved → solved, the pre-insertion state gives us the case that was just solved.

## State Tuple & Normalization

For a given slot, locate its two pieces (corner and edge) in the current `KPattern` and encode:

```
(corner_loc, corner_orient, edge_loc, edge_orient)
```

### Corner location (normalized from raw position index)

- `target` — in its home slot
- `u0, u1, u2, u3` — U-layer corner positions, relative to slot (u0 = directly above, then clockwise)
- `other1, other2, other3` — other D-layer corner slots, relative (clockwise)

### Corner orientation

0, 1, or 2 (cubing.js native twist value)

### Edge location (normalized from raw position index)

- `target` — in its home slot
- `u0, u1, u2, u3` — U-layer edge positions, relative to slot (u0 = edge above slot's front face, then clockwise)
- `other1, other2, other3` — other equator edge slots, relative
- `d1, d2, d3` — other D-layer edge positions (cross edges — rare mid-solve)

### Edge orientation

0 or 1 (cubing.js native flip value)

### Why normalize relative to the slot?

So the same F2L case produces the same tuple regardless of which slot it's in. The normalization is a rotation mapping: define 4 canonical Y-rotations (one per slot) that map each slot to the FR position, then express all positions through that lens. Analogous to AUF rotations for OLL/PLL.

## Lookup Table Generation

Generate the table programmatically from the 41 canonical F2L algorithms:

1. Start from a solved cube state
2. For each case, apply the **inverse** of its algorithm — this produces the state the algorithm solves
3. Extract the normalized state tuple for the FR slot (canonical)
4. Store as `Map<string, F2LCase>` keyed by stringified tuple

**Why invert?** The algorithm takes case → solved. We want solved → case.

**Verification:** A test applies each algorithm to its generated state and confirms the slot is solved (round-trip).

**Algorithm ambiguity:** Some cases have multiple common solutions. We pick one canonical algorithm per case. The fingerprint represents the state, not the solution — any correct algorithm for the case generates the same tuple.

## Case Definitions

Hardcoded in `f2l-cases.ts`, following the pattern of `oll-cases.ts`/`pll-cases.ts`:

```typescript
interface F2LCaseDefinition {
  name: string;        // "F2L #1" through "F2L #41"
  algorithm: string;   // canonical solution algorithm
}
```

## Recognition Function

```typescript
interface F2LSlotState {
  slot: SlotId;             // FR, FL, BR, BL (relative to cross face)
  solved: boolean;
  caseName: string | null;  // "F2L #31" or null if non-standard
  tuple: NormalizedTuple;   // always present, even for non-standard states
}

async function recognizeF2LSlots(
  state: KPattern,
  crossFace: string,
): Promise<F2LSlotState[]>
```

**Flow:**

1. Build slot definitions from `FaceGeometry` + cross face
2. For each of the 4 slots:
   - If solved (corner + edge home with orient 0) → `{ solved: true, caseName: null }`
   - Otherwise, locate the slot's corner and edge in current state
   - Compute normalized tuple
   - Hash-map lookup against generated table
   - Return match or `{ caseName: null, tuple }` for non-standard

**Slot transition detection** is the caller's responsibility: compare consecutive `F2LSlotState[]` to detect solved transitions. The previous frame's state for that slot gives the case.

**Performance:** 4 slots × O(1) hash lookup per move. Negligible.

## Non-Standard State Handling

The tuple is total — every possible position/orientation produces a valid tuple. Standard cases are the subset in the lookup table. Everything else is implicitly non-standard:

- **Pieces in U-layer or target slot** — standard 41 cases, direct lookup match
- **Pieces in wrong D-layer slot** — tuple has `other` locations, no standard match, `caseName: null`
- **Edge in cross position** — rare mid-solve, same treatment

No special-casing needed. Future extension: classify non-standard tuples by location for training feedback (out of scope).

## Deliverables

### 1. `src/core/f2l-cases.ts`

41 case definitions (name + canonical algorithm).

### 2. `src/core/f2l-recognizer.ts`

- Slot definition derivation from cross face
- Normalized tuple extraction
- Lookup table generation (run once, cached)
- `recognizeF2LSlots()` function

### 3. `src/core/__tests__/f2l-recognizer.test.ts`

- Round-trip: each of 41 cases generates a state that is correctly recognized
- All 4 slots: normalization produces same case regardless of slot
- Non-standard states: pieces in wrong slots return `caseName: null` with valid tuple
- Slot transition: given a move sequence, detect which slot solved and what case

### 4. Spike findings document

Feasibility assessment answering:
- Does the fingerprint approach scale to F2L?
- How well does slot-relative normalization work?
- Edge cases or surprises?
- Recommendation: build or defer

## Out of Scope

- Database schema changes
- UI components
- Segmenter integration
- Non-standard case categorization
- Standalone F2L trainer mode
