export interface F2LCaseDefinition {
  name: string; // "F2L #1" through "F2L #41"
  algorithm: string; // canonical solution algorithm (FR slot)
}

/**
 * 41 standard F2L cases with canonical solutions for the FR slot.
 * Algorithms sourced from SpeedCubeDB (https://speedcubedb.com/a/3x3/F2L).
 *
 * All algorithms target the front-right (FR) slot using standard notation.
 * The cross face is D. The FR pair is the DFR corner (white/red/green)
 * and the FR edge (red/green).
 */
export const F2L_CASES: F2LCaseDefinition[] = [
  // --- Free pairs: corner and edge in U layer, already paired ---
  { name: "F2L #1", algorithm: "U R U' R'" },
  { name: "F2L #2", algorithm: "F R' F' R" },
  { name: "F2L #3", algorithm: "F' U' F" },
  { name: "F2L #4", algorithm: "R U R'" },

  // --- Disconnected pairs: corner and edge in U layer, not connected ---
  { name: "F2L #5", algorithm: "U' R U R' U2 R U' R'" },
  { name: "F2L #6", algorithm: "U' r U' R' U R U r'" },
  { name: "F2L #7", algorithm: "U' R U2 R' U' R U2 R'" },
  { name: "F2L #8", algorithm: "U2 F' U' F U' R U R'" },
  { name: "F2L #9", algorithm: "U' R U' R' U F' U' F" },
  { name: "F2L #10", algorithm: "U' R U R' U R U R'" },

  // --- Connected pairs: corner and edge in U layer, connected but twisted ---
  { name: "F2L #11", algorithm: "U' R U2 R' U F' U' F" },
  { name: "F2L #12", algorithm: "R U' R' U R U' R' U2 R U' R'" },
  { name: "F2L #13", algorithm: "U F' U F U' F' U' F" },
  { name: "F2L #14", algorithm: "U' R U' R' U R U R'" },
  { name: "F2L #15", algorithm: "R U' R' U2 R U R' U' R U R'" },
  { name: "F2L #16", algorithm: "R U' R' U2 F' U' F" },

  // --- Corner in U layer, edge in U layer (different orientation) ---
  { name: "F2L #17", algorithm: "R U2 R' U' R U R'" },
  { name: "F2L #18", algorithm: "F' U2 F U F' U' F" },
  { name: "F2L #19", algorithm: "U R U2 R' U R U' R'" },
  { name: "F2L #20", algorithm: "U' F' U2 F U' F' U F" },
  { name: "F2L #21", algorithm: "U2 R U R' U R U' R'" },
  { name: "F2L #22", algorithm: "r U' r' U2 r U r'" },
  { name: "F2L #23", algorithm: "U R U' R' U' R U' R' U R U' R'" },
  { name: "F2L #24", algorithm: "F U R U' R' F' R U' R'" },

  // --- Corner in slot, edge in U layer ---
  { name: "F2L #25", algorithm: "U' R' F R F' R U R'" },
  { name: "F2L #26", algorithm: "U R U' R' F R' F' R" },
  { name: "F2L #27", algorithm: "R U' R' U R U' R'" },
  { name: "F2L #28", algorithm: "R U R' U' F R' F' R" },
  { name: "F2L #29", algorithm: "R' F R F' U R U' R'" },
  { name: "F2L #30", algorithm: "R U R' U' R U R'" },

  // --- Edge in slot, corner in U layer ---
  { name: "F2L #31", algorithm: "U' R' F R F' R U' R'" },
  { name: "F2L #32", algorithm: "U R U' R' U R U' R' U R U' R'" },
  { name: "F2L #33", algorithm: "U' R U' R' U2 R U' R'" },
  { name: "F2L #34", algorithm: "U R U R' U2 R U R'" },
  { name: "F2L #35", algorithm: "U' R U R' U F' U' F" },
  { name: "F2L #36", algorithm: "U F' U' F U' R U R'" },

  // --- Both pieces in slot (wrong) ---
  { name: "F2L #37", algorithm: "R2 U2 F R2 F' U2 R' U R'" },
  { name: "F2L #38", algorithm: "R U' R' U' R U R' U2 R U' R'" },
  { name: "F2L #39", algorithm: "R U' R' U R U2 R' U R U' R'" },
  { name: "F2L #40", algorithm: "r U' r' U2 r U r' R U R'" },
  { name: "F2L #41", algorithm: "R U' R' r U' r' U2 r U r'" },
];
