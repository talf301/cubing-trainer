export interface CaseFingerprint {
  corners: number[];
  edges: number[];
  algorithm: string;
}

export const OLL_CASES: Record<string, CaseFingerprint> = {
  "OLL 1": {
    corners: [1, 2, 1, 2],
    edges: [1, 1, 1, 1],
    algorithm: "R U2' R2' F R F' U2 R' F R F'",
  },
  "OLL 2": {
    corners: [2, 2, 1, 1],
    edges: [1, 1, 1, 1],
    algorithm: "R U' R2' D' r U r' D R2 U R'",
  },
  "OLL 3": {
    corners: [0, 2, 2, 2],
    edges: [1, 1, 1, 1],
    algorithm: "f (R U R' U') f' U' F (R U R' U') F'",
  },
  "OLL 4": {
    corners: [1, 0, 1, 1],
    edges: [1, 1, 1, 1],
    algorithm: "f R U R' U' f' U F R U R' U' F'",
  },
  "OLL 5": {
    corners: [2, 2, 0, 2],
    edges: [1, 1, 0, 0],
    algorithm: "l' U2 L U L' U l",
  },
  "OLL 6": {
    corners: [1, 0, 1, 1],
    edges: [1, 0, 0, 1],
    algorithm: "r U2 R' U' R U' r'",
  },
  "OLL 7": {
    corners: [2, 2, 2, 0],
    edges: [1, 1, 0, 0],
    algorithm: "r U R' U R U2 r'",
  },
  "OLL 8": {
    corners: [0, 1, 1, 1],
    edges: [1, 0, 0, 1],
    algorithm: "l' U' L U' L' U2 l",
  },
  "OLL 9": {
    corners: [0, 1, 1, 1],
    edges: [1, 1, 0, 0],
    algorithm: "R U R' U' R' F R2 U R' U' F'",
  },
  "OLL 10": {
    corners: [2, 0, 2, 2],
    edges: [0, 1, 1, 0],
    algorithm: "R U R' U R' F R F' R U2' R'",
  },
  "OLL 11": {
    corners: [2, 2, 2, 0],
    edges: [0, 0, 1, 1],
    algorithm: "r' R2 U R' U R U2' R' U M'",
  },
  "OLL 12": {
    corners: [1, 1, 0, 1],
    edges: [1, 0, 0, 1],
    algorithm: "r R2' U' R U' R' U2 R U' r' R",
  },
  "OLL 13": {
    corners: [2, 2, 2, 0],
    edges: [1, 0, 1, 0],
    algorithm: "F U R U2' R' U' R U R' F'",
  },
  "OLL 14": {
    corners: [0, 1, 1, 1],
    edges: [1, 0, 1, 0],
    algorithm: "R' F R U R' F' R F U' F'",
  },
  "OLL 15": {
    corners: [2, 2, 0, 2],
    edges: [1, 0, 1, 0],
    algorithm: "l' U' l L' U' L U l' U l",
  },
  "OLL 16": {
    corners: [1, 0, 1, 1],
    edges: [1, 0, 1, 0],
    algorithm: "r U r' R U R' U' r U' r'",
  },
  "OLL 17": {
    corners: [0, 1, 0, 2],
    edges: [1, 1, 1, 1],
    algorithm: "R U R' U R' F R F' U2 R' F R F'",
  },
  "OLL 18": {
    corners: [0, 0, 1, 2],
    edges: [1, 1, 1, 1],
    algorithm: "R U2 R2 F R F' U2 M' U R U' r'",
  },
  "OLL 19": {
    corners: [0, 0, 2, 1],
    edges: [1, 1, 1, 1],
    algorithm: "S' R U R' S U' R' F R F'",
  },
  "OLL 20": {
    corners: [0, 0, 0, 0],
    edges: [1, 1, 1, 1],
    algorithm: "r' R U R U R' U' r R' M' U R U' r'",
  },
  "OLL 21": {
    corners: [1, 2, 1, 2],
    edges: [0, 0, 0, 0],
    algorithm: "R U R' U R U' R' U R U2 R'",
  },
  "OLL 22": {
    corners: [2, 1, 1, 2],
    edges: [0, 0, 0, 0],
    algorithm: "R U2' R2' U' R2 U' R2' U2' R",
  },
  "OLL 23": {
    corners: [0, 1, 2, 0],
    edges: [0, 0, 0, 0],
    algorithm: "R2' D' R U2 R' D R U2 R",
  },
  "OLL 24": {
    corners: [0, 0, 2, 1],
    edges: [0, 0, 0, 0],
    algorithm: "r U R' U' r' F R F'",
  },
  "OLL 25": {
    corners: [0, 2, 0, 1],
    edges: [0, 0, 0, 0],
    algorithm: "F R' F' r U R U' r'",
  },
  "OLL 26": {
    corners: [1, 0, 1, 1],
    edges: [0, 0, 0, 0],
    algorithm: "R U2 R' U' R U' R'",
  },
  "OLL 27": {
    corners: [2, 2, 2, 0],
    edges: [0, 0, 0, 0],
    algorithm: "R U R' U R U2' R'",
  },
  "OLL 28": {
    corners: [0, 0, 0, 0],
    edges: [1, 1, 0, 0],
    algorithm: "r U R' U' r' R U R U' R'",
  },
  "OLL 29": {
    corners: [0, 0, 2, 1],
    edges: [1, 1, 0, 0],
    algorithm: "R U R' U' R U' R' F' U' F R U R'",
  },
  "OLL 30": {
    corners: [0, 2, 1, 0],
    edges: [1, 1, 0, 0],
    algorithm: "F U R U2' R' U' R U2 R' U' F'",
  },
  "OLL 31": {
    corners: [0, 0, 2, 1],
    edges: [1, 0, 0, 1],
    algorithm: "R' U' F U R U' R' F' R",
  },
  "OLL 32": {
    corners: [0, 0, 2, 1],
    edges: [0, 0, 1, 1],
    algorithm: "S R U R' U' R' F R f'",
  },
  "OLL 33": {
    corners: [0, 0, 2, 1],
    edges: [1, 0, 1, 0],
    algorithm: "R U R' U' R' F R F'",
  },
  "OLL 34": {
    corners: [0, 2, 1, 0],
    edges: [1, 0, 1, 0],
    algorithm: "R U R2' U' R' F R U R U' F'",
  },
  "OLL 35": {
    corners: [0, 2, 0, 1],
    edges: [0, 0, 1, 1],
    algorithm: "R U2' R2' F R F' R U2' R'",
  },
  "OLL 36": {
    corners: [0, 1, 0, 2],
    edges: [1, 0, 0, 1],
    algorithm: "L' U' L U' L' U L U L F' L' F",
  },
  "OLL 37": {
    corners: [0, 2, 0, 1],
    edges: [1, 1, 0, 0],
    algorithm: "F R' F' R U R U' R'",
  },
  "OLL 38": {
    corners: [1, 0, 2, 0],
    edges: [1, 1, 0, 0],
    algorithm: "R U R' U R U' R' U' R' F R F'",
  },
  "OLL 39": {
    corners: [1, 0, 2, 0],
    edges: [1, 0, 1, 0],
    algorithm: "L F' L' U' L U F U' L'",
  },
  "OLL 40": {
    corners: [0, 1, 0, 2],
    edges: [1, 0, 1, 0],
    algorithm: "R' F R U R' U' F' U R",
  },
  "OLL 41": {
    corners: [0, 1, 2, 0],
    edges: [1, 1, 0, 0],
    algorithm: "R U R' U R U2 R' F R U R' U' F'",
  },
  "OLL 42": {
    corners: [2, 0, 0, 1],
    edges: [0, 1, 1, 0],
    algorithm: "R' U' R U' R' U2' R F R U R' U' F'",
  },
  "OLL 43": {
    corners: [2, 0, 0, 1],
    edges: [1, 1, 0, 0],
    algorithm: "R' U' F' U F R",
  },
  "OLL 44": {
    corners: [1, 2, 0, 0],
    edges: [1, 1, 0, 0],
    algorithm: "F U R U' R' F'",
  },
  "OLL 45": {
    corners: [0, 0, 1, 2],
    edges: [1, 0, 1, 0],
    algorithm: "F R U R' U' F'",
  },
  "OLL 46": {
    corners: [1, 2, 0, 0],
    edges: [0, 1, 0, 1],
    algorithm: "R' U' R' F R F' U R",
  },
  "OLL 47": {
    corners: [1, 1, 2, 2],
    edges: [1, 1, 0, 0],
    algorithm: "F R' F' R U2 R U' R' U R U2' R'",
  },
  "OLL 48": {
    corners: [2, 1, 1, 2],
    edges: [1, 1, 0, 0],
    algorithm: "F R U R' U' R U R' U' F'",
  },
  "OLL 49": {
    corners: [2, 1, 1, 2],
    edges: [1, 0, 0, 1],
    algorithm: "r U' r2' U r2 U r2' U' r",
  },
  "OLL 50": {
    corners: [1, 2, 2, 1],
    edges: [1, 1, 0, 0],
    algorithm: "R' F R2 B' R2' F' R2 B R'",
  },
  "OLL 51": {
    corners: [1, 2, 2, 1],
    edges: [1, 0, 1, 0],
    algorithm: "F U R U' R' U R U' R' F'",
  },
  "OLL 52": {
    corners: [1, 2, 2, 1],
    edges: [0, 1, 0, 1],
    algorithm: "R U R' U R U' B U' B' R'",
  },
  "OLL 53": {
    corners: [1, 2, 1, 2],
    edges: [1, 1, 0, 0],
    algorithm: "l' U' L U' L' U L U' L' U2 l",
  },
  "OLL 54": {
    corners: [1, 2, 1, 2],
    edges: [1, 0, 0, 1],
    algorithm: "r U R' U R U' R' U R U2' r'",
  },
  "OLL 55": {
    corners: [2, 1, 2, 1],
    edges: [1, 0, 1, 0],
    algorithm: "R' F R U R U' R2' F' R2 U' R' U R U R'",
  },
  "OLL 56": {
    corners: [1, 2, 1, 2],
    edges: [1, 0, 1, 0],
    algorithm: "r U r' U R U' R' U R U' R' r U' r'",
  },
  "OLL 57": {
    corners: [0, 0, 0, 0],
    edges: [1, 0, 1, 0],
    algorithm: "R U R' U' M' U R U' r'",
  },
};
