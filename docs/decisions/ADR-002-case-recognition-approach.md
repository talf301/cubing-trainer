# ADR-002: Case recognition approach for OLL/PLL identification

## Status
Accepted

## Context
Phase 4 requires recognizing which of 57 OLL and 21 PLL cases occurred in each solve.
The phase brief says: "Investigate cubing.js pattern matching utilities for case
recognition before building a lookup table approach."

### cubing.js investigation
cubing.js v0.63.3 provides `KPuzzle` and `KPattern` for cube state management but has
no built-in case recognition, pattern classification, or case labeling utilities. The
`experimentalIsSolved` method checks if a puzzle is solved but cannot classify partial
states into named cases. There are no OLL/PLL lookup tables or pattern matchers in the
library.

### Options considered

**A. Fingerprint pattern matching:** Extract compact orientation vectors (OLL) or
permutation vectors (PLL) from the last-layer pieces at phase boundaries. Match against
a pre-computed lookup table of 78 fingerprints.

**B. Full state comparison:** Store complete KPattern states for all 78 cases. Compare
the boundary state against each reference state, accounting for AUF.

**C. Algorithmic classification:** Write procedural code that analyzes piece positions
to classify cases (e.g., "if these two corners are oriented and these edges aren't,
it's OLL 33").

## Decision
Use fingerprint pattern matching (Option A).

## Rationale
- **Compact:** Each case is two small arrays (4 corner values + 4 edge values) rather
  than a full puzzle state. Total data for all 78 cases is ~1.2 KB.
- **Fast matching:** Array comparison is O(n) where n=8. AUF normalization is a cyclic
  rotation of the array, not a cube move application.
- **Deterministic:** Same state always produces the same fingerprint. Satisfies the
  project invariant: "Case recognition must be deterministic and based on cubing.js
  cube state, not heuristics or move-count guesses."
- **Verifiable:** Patterns are generated from standard algorithms via cubing.js, then
  verified by applying the algorithm to the fingerprint state and asserting solved.
- **Cross-face agnostic:** Extraction uses `buildFaceGeometry` (already in codebase)
  to find last-layer piece positions relative to any cross face.

Option B was rejected because full state comparison is heavier and AUF handling requires
generating 4 variants per case (312 states total). Option C was rejected because
procedural classification for 78 cases would be error-prone and hard to verify
exhaustively.

## Consequences
- We maintain a static dataset of 78 fingerprint patterns in `src/core/`.
- A generation script produces patterns from standard algorithms; verification tests
  independently validate them.
- The recognizer depends on cubing.js `KPattern` internals (piece/orientation arrays
  in `patternData`). If cubing.js changes its internal representation, the extraction
  code needs updating.
- Adding new case sets (e.g., F2L pairs) later follows the same pattern: define
  fingerprints, write a recognizer function.
