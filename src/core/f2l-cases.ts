export interface F2LCaseDefinition {
  name: string; // "F2L #1" through "F2L #41"
  algorithms: string[]; // solution algorithms for FR slot, first is used for scramble generation
}

/**
 * 41 standard F2L cases with solutions for the FR slot.
 * Algorithms sourced from SpeedCubeDB (https://speedcubedb.com/a/3x3/F2L).
 *
 * All algorithms target the front-right (FR) slot using standard notation.
 * The cross face is D. The FR pair is the DFR corner (white/red/green)
 * and the FR edge (red/green).
 *
 * The first algorithm in each array is used for scramble generation and
 * solve verification. Additional algorithms are shown as reference
 * alternatives during review — they include rotation-based variants
 * (y, y', d) that solve the same visual case from a different angle.
 */
export const F2L_CASES: F2LCaseDefinition[] = [
  // --- Free pairs: corner and edge in U layer, already paired ---
  { name: "F2L #1", algorithms: [
    "U R U' R'",
    "R' F R F'",
    "y' r' U' R U M'",
  ] },
  { name: "F2L #2", algorithms: [
    "F R' F' R",
    "y' U' R' U R",
    "U' F' U F",
  ] },
  { name: "F2L #3", algorithms: [
    "F' U' F",
    "y' R' U' R",
    "S U R U' R' S'",
  ] },
  { name: "F2L #4", algorithms: [
    "R U R'",
    "y' f R f'",
    "y F U F'",
  ] },

  // --- Disconnected pairs: corner and edge in U layer, not connected ---
  { name: "F2L #5", algorithms: [
    "U' R U R' U2 R U' R'",
    "F2 L' U' L U F2",
    "U' R U R' U' R U2 R'",
    "U' R U R' U R' F R F'",
  ] },
  { name: "F2L #6", algorithms: [
    "U' r U' R' U R U r'",
    "d R' U' R U2 R' U R",
    "U F' U' F U2 F' U F",
  ] },
  { name: "F2L #7", algorithms: [
    "U' R U2 R' U' R U2 R'",
    "M' U' M U2 r U' r'",
    "U' R U2 R' U R' F R F'",
    "U' R U2 R' U2 R U' R'",
  ] },
  { name: "F2L #8", algorithms: [
    "r' U2 R2 U R2 U r",
    "d R' U2 R U R' U2 R",
    "y' U R' U2 R U2 R' U R",
  ] },
  { name: "F2L #9", algorithms: [
    "U' R U' R' U F' U' F",
    "F R U R' U' F' R U' R'",
    "U' R U' R' d R' U' R",
    "d R' U' R U' R' U' R",
  ] },
  { name: "F2L #10", algorithms: [
    "U' R U R' U R U R'",
    "U2 R U' R' U' R U R'",
  ] },

  // --- Connected pairs: corner and edge in U layer, connected but twisted ---
  { name: "F2L #11", algorithms: [
    "U' R U2 R' U F' U' F",
    "y' R U2 R2 U' R2 U' R'",
    "U' R U2 R' d R' U' R",
    "F' U L' U2 L U2 F",
  ] },
  { name: "F2L #12", algorithms: [
    "R U' R' U R U' R' U2 R U' R'",
    "R' U2 R2 U R2 U R",
    "U R U' R' U' R U R' U' R U R'",
    "R' D' R U2 R' D R2 U R'",
  ] },
  { name: "F2L #13", algorithms: [
    "R U' R' U R' F R F' R U' R'",
    "y' U R' U R U' R' U' R",
    "M' U' R U R' U2 R U' r'",
    "d R' U R U' R' U' R",
  ] },
  { name: "F2L #14", algorithms: [
    "U' R U' R' U R U R'",
    "R U2 R' U2 R U R' U2 R U' R'",
    "U' R2 D R' U R D' R2",
    "U2 R2 U R' U R U2 R2",
  ] },
  { name: "F2L #15", algorithms: [
    "R' D' R U' R' D R U R U' R'",
    "M U r U' r' U' M'",
    "R U R' U2 R U' R' U R U' R'",
    "F' U F U2 R U R'",
  ] },
  { name: "F2L #16", algorithms: [
    "R U' R' U2 F' U' F",
    "R U' R' U2 y' R' U' R",
    "U M' U R U' r' U' R U R'",
    "U F U R U' R' F' R U R'",
  ] },

  // --- Corner in U layer, edge in U layer (different orientation) ---
  { name: "F2L #17", algorithms: [
    "R U2 R' U' R U R'",
    "R U R' U' R U2 R' U2 R U R'",
  ] },
  { name: "F2L #18", algorithms: [
    "F' U2 F U F' U' F",
    "y' R' U2 R U R' U' R",
    "R' F R F' R U' R' U R U' R'",
  ] },
  { name: "F2L #19", algorithms: [
    "U R U2 R' U R U' R'",
    "U R U2 R2 F R F'",
    "d f R2 f' U f R' f'",
    "R U' R' U R U' R' U R U R'",
  ] },
  { name: "F2L #20", algorithms: [
    "U' F' U2 F U' F' U F",
    "y' U' R' U2 R U' R' U R",
    "U' R U' R2 F R F' R U' R'",
  ] },
  { name: "F2L #21", algorithms: [
    "U2 R U R' U R U' R'",
    "R U' R' U2 R U R'",
    "R B U2 B' R'",
    "y' f R' f' U2 f R f'",
  ] },
  { name: "F2L #22", algorithms: [
    "r U' r' U2 r U r'",
    "F' L' U2 L F",
    "y' U2 R' U' R U' R' U R",
  ] },
  { name: "F2L #23", algorithms: [
    "U R U' R' U' R U' R' U R U' R'",
    "R U R' U2 R U R' U' R U R'",
    "U2 R2 U2 R' U' R U' R2",
    "R U' R2 D' R U2 R' D R",
  ] },
  { name: "F2L #24", algorithms: [
    "F U R U' R' F' R U' R'",
    "y' R' U' R U2 R' U' R U R' U' R",
    "U' R U R2 F R F' R U' R'",
  ] },

  // --- Corner in slot, edge in U layer ---
  { name: "F2L #25", algorithms: [
    "U' R' F R F' R U R'",
    "R' F' R U R U' R' F",
    "U' F' R U R' U' R' F R",
    "U' F' U F U R U' R'",
  ] },
  { name: "F2L #26", algorithms: [
    "U R U' R' F R' F' R",
    "R S' R' U R S R'",
    "U R U' R' U' F' U F",
  ] },
  { name: "F2L #27", algorithms: [
    "R U' R' U R U' R'",
    "F' U' F U2 R U' R'",
  ] },
  { name: "F2L #28", algorithms: [
    "R U R' U' F R' F' R",
    "F' U F U' F' U F",
    "y' R' U R U' R' U R",
  ] },
  { name: "F2L #29", algorithms: [
    "R' F R F' U R U' R'",
    "R' F R F' R' F R F'",
    "y' R' U' R U R' U' R",
  ] },
  { name: "F2L #30", algorithms: [
    "R U R' U' R U R'",
    "U' R U2 R' U2 R U R'",
    "U' F R' F' R2 U R'",
    "U2 F' U F R U R'",
  ] },

  // --- Edge in slot, corner in U layer ---
  { name: "F2L #31", algorithms: [
    "U' R' F R F' R U' R'",
    "F' U F R U2 R'",
    "R U' R' U y' R' U R",
  ] },
  { name: "F2L #32", algorithms: [
    "U R U' R' U R U' R' U R U' R'",
    "R U R' U' R U R' U' R U R'",
    "R2 U R2 U R2 U2 R2",
    "U' F R' F' R U' R U R'",
  ] },
  { name: "F2L #33", algorithms: [
    "U' R U' R' U2 R U' R'",
    "R U R' U' R U' R' U R U' R'",
    "U' R U' R' U' R U2 R'",
    "y R' D R U' R' D' R",
  ] },
  { name: "F2L #34", algorithms: [
    "U R U R' U2 R U R'",
    "U' R U2 R' U R U R'",
    "U R' D' R U' R' D R",
  ] },
  { name: "F2L #35", algorithms: [
    "U' R U R' U F' U' F",
    "U' R U R' d R' U' R",
    "U2 R U R' F R' F' R",
  ] },
  { name: "F2L #36", algorithms: [
    "U F' U' F U' R U R'",
    "U2 R' F R F' U2 R U R'",
    "R U R' U R U R' U' F' U' F",
  ] },

  // --- Both pieces in slot (wrong) ---
  { name: "F2L #37", algorithms: [
    "R2 U2 F R2 F' U2 R' U R'",
    "R U2 R' U R U2 R' U F' U' F",
    "R U R' U2 R U2 R' U y' R' U' R",
  ] },
  { name: "F2L #38", algorithms: [
    "R U' R' U' R U R' U2 R U' R'",
    "R U R' U' R U2 R' U' R U R'",
    "R2 U2 R' U' R U' R' U2 R'",
    "R U' R' U' R U R' U' R U2 R'",
  ] },
  { name: "F2L #39", algorithms: [
    "R U' R' U R U2 R' U R U' R'",
    "R U2 R U R' U R U2 R2",
    "R U R' U2 R U' R' U R U R'",
    "R U2 R' U R U' R' U R U R'",
  ] },
  { name: "F2L #40", algorithms: [
    "r U' r' U2 r U r' R U R'",
    "F' L' U2 L F R U R'",
    "R U' R' F R U R' U' F' R U' R'",
    "R U' R' U' R U' R' U y' R' U' R",
  ] },
  { name: "F2L #41", algorithms: [
    "R U' R' r U' r' U2 r U r'",
    "R U' R' F' L' U2 L F",
    "R U R' U' R U' R' U2 y' R' U' R",
  ] },
];
