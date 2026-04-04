export interface F2LCaseDefinition {
  name: string; // "F2L #1" through "F2L #41"
  algorithm: string; // canonical solution algorithm (FR slot)
}

/**
 * 41 standard F2L cases with canonical solutions for the FR slot.
 * Algorithms assume white cross on bottom, solving the front-right slot.
 *
 * Numbering follows the standard Fridrich F2L numbering convention.
 */
export const F2L_CASES: F2LCaseDefinition[] = [
  // --- Basic inserts: corner and edge in U layer ---
  { name: "F2L #1", algorithm: "U R U' R'" },
  { name: "F2L #2", algorithm: "F' U' F" },
  { name: "F2L #3", algorithm: "F' U F" },
  { name: "F2L #4", algorithm: "U' R U R'" },

  // --- Corner in U, edge in slot ---
  { name: "F2L #5", algorithm: "U' R U' R' U R U R'" },
  { name: "F2L #6", algorithm: "U' R U R' U R U R'" },
  { name: "F2L #7", algorithm: "U' R U2 R' U R U R'" },
  { name: "F2L #8", algorithm: "d R' U2 R U' R' U' R" },
  { name: "F2L #9", algorithm: "U' R U R' d R' U' R" },
  { name: "F2L #10", algorithm: "U R U' R' U' F' U F" },
  { name: "F2L #11", algorithm: "d R' U' R U R' U' R" },
  { name: "F2L #12", algorithm: "R U' R' U R U' R'" },
  { name: "F2L #13", algorithm: "U' R U2 R' d R' U' R" },
  { name: "F2L #14", algorithm: "U R U2 R' U R U R'" },
  { name: "F2L #15", algorithm: "d R' U R U' R' U' R" },
  { name: "F2L #16", algorithm: "U R U' R' U' R U' R' U R U' R'" },

  // --- Corner in slot, edge in U layer ---
  { name: "F2L #17", algorithm: "R U2 R' U' R U R'" },
  { name: "F2L #18", algorithm: "F' U2 F U F' U' F" },
  { name: "F2L #19", algorithm: "U R U2 R2 F R F'" },
  { name: "F2L #20", algorithm: "R U R' U2 R U R'" },
  { name: "F2L #21", algorithm: "R U' R' U2 F' U' F" },
  { name: "F2L #22", algorithm: "F' U F U2 R U R'" },
  { name: "F2L #23", algorithm: "U R U' R' F' U' F" },
  { name: "F2L #24", algorithm: "U' F' U F R U R'" },

  // --- Corner and edge both in U layer, need pairing ---
  { name: "F2L #25", algorithm: "U' R U' R' U F' U' F" },
  { name: "F2L #26", algorithm: "U' R U R' U R U R'" },
  { name: "F2L #27", algorithm: "R U' R' U R U' R'" },
  { name: "F2L #28", algorithm: "R U R' U' F R' F' R" },
  { name: "F2L #29", algorithm: "R' F R F' R U R' U'" },
  { name: "F2L #30", algorithm: "R U' R' U' R U R' U2 R U' R'" },
  { name: "F2L #31", algorithm: "R U R' U2 R U' R' U R U' R'" },
  { name: "F2L #32", algorithm: "U R U R' U R U R'" },

  // --- Corner in slot, edge in slot (both wrong) ---
  { name: "F2L #33", algorithm: "U R U' R' U' R U R' U R U' R'" },
  { name: "F2L #34", algorithm: "U' R U R' d R' U' R" },

  // --- Corner oriented in slot, edge misoriented or vice versa ---
  { name: "F2L #35", algorithm: "U' R U' R' U R U R'" },
  { name: "F2L #36", algorithm: "U R U R' U' R U R'" },
  { name: "F2L #37", algorithm: "R2 U R2 U R2 U2 R2" },

  // --- Pair formed but needs insertion ---
  { name: "F2L #38", algorithm: "R U R' U' R U R' U' R U R'" },
  { name: "F2L #39", algorithm: "R U' R' U R U' R'" },
  { name: "F2L #40", algorithm: "R U' R' d R' U R" },
  { name: "F2L #41", algorithm: "R U R' U' R U R'" },
];
