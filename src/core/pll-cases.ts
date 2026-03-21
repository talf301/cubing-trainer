import { type CaseFingerprint } from "./oll-cases";

export const PLL_CASES: Record<string, CaseFingerprint> = {
  Aa: {
    corners: [2, 0, 1, 3],
    edges: [0, 1, 2, 3],
    algorithm: "x R' U R' D2 R U' R' D2 R2 x'",
  },
  Ab: {
    corners: [1, 2, 0, 3],
    edges: [0, 1, 2, 3],
    algorithm: "x R2' D2 R U R' D2 R U' R x'",
  },
  E: {
    corners: [1, 0, 3, 2],
    edges: [0, 1, 2, 3],
    algorithm: "x' R U' R' D R U R' D' R U R' D R U' R' D' x",
  },
  F: {
    corners: [1, 0, 2, 3],
    edges: [2, 1, 0, 3],
    algorithm: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
  },
  Ga: {
    corners: [1, 0, 2, 3],
    edges: [1, 3, 0, 2],
    algorithm: "R2 U R' U R' U' R U' R2 D U' R' U R D'",
  },
  Gb: {
    corners: [1, 0, 2, 3],
    edges: [2, 0, 3, 1],
    algorithm: "R' U' R U D' R2 U R' U R U' R U' R2 D",
  },
  Gc: {
    corners: [1, 0, 2, 3],
    edges: [2, 3, 1, 0],
    algorithm: "R2 U' R U' R U R' U R2 D' U R U' R' D",
  },
  Gd: {
    corners: [1, 0, 2, 3],
    edges: [3, 2, 0, 1],
    algorithm: "R U R' U' D R2 U' R U' R' U R' U R2 D'",
  },
  H: {
    corners: [0, 1, 2, 3],
    edges: [2, 3, 0, 1],
    algorithm: "M2' U M2' U2 M2' U M2'",
  },
  Ja: {
    corners: [1, 0, 2, 3],
    edges: [0, 2, 1, 3],
    algorithm: "x R2' F R F' R U2 r' U r U2 x'",
  },
  Jb: {
    corners: [0, 3, 1, 2],
    edges: [0, 3, 1, 2],
    algorithm: "R U R' F' R U R' U' R' F R2 U' R'",
  },
  Na: {
    corners: [0, 3, 2, 1],
    edges: [0, 3, 2, 1],
    algorithm: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
  },
  Nb: {
    corners: [2, 1, 0, 3],
    edges: [0, 3, 2, 1],
    algorithm: "R' U R U' R' F' U' F R U R' F R' F' R U' R",
  },
  Ra: {
    corners: [0, 3, 1, 2],
    edges: [3, 0, 2, 1],
    algorithm: "R U' R' U' R U R D R' U' R D' R' U2 R'",
  },
  Rb: {
    corners: [3, 1, 0, 2],
    edges: [0, 3, 1, 2],
    algorithm: "R' U2 R U2 R' F R U R' U' R' F' R2",
  },
  T: {
    corners: [1, 0, 2, 3],
    edges: [0, 3, 2, 1],
    algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'",
  },
  Ua: {
    corners: [0, 1, 2, 3],
    edges: [1, 3, 2, 0],
    algorithm: "M2' U M U2 M' U M2'",
  },
  Ub: {
    corners: [0, 1, 2, 3],
    edges: [3, 0, 2, 1],
    algorithm: "M2' U' M U2 M' U' M2'",
  },
  V: {
    corners: [1, 0, 3, 2],
    edges: [3, 1, 0, 2],
    algorithm: "R' U R' U' y R' F' R2 U' R' U R' F R F",
  },
  Y: {
    corners: [2, 1, 0, 3],
    edges: [0, 1, 3, 2],
    algorithm: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  },
  Z: {
    corners: [3, 0, 1, 2],
    edges: [2, 1, 0, 3],
    algorithm: "M' U M2' U M2' U M' U2 M2'",
  },
};
