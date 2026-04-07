import { Move } from "cubing/alg";

export function invertMove(moveStr: string): string {
  const inverted = new Move(moveStr).invert().toString();
  // cubing.js represents the inverse of U2 as "U2'" but U2 is self-inverse
  if (inverted.endsWith("2'")) {
    return inverted.slice(0, -1);
  }
  return inverted;
}

export function moveFamily(moveStr: string): string {
  return new Move(moveStr).family;
}

export function moveAmount(moveStr: string): number {
  return new Move(moveStr).amount;
}

export function normalizeAmount(amount: number): number {
  const mod = ((amount % 4) + 4) % 4;
  if (mod === 3) return -1;
  if (mod === 0) return 0;
  return mod;
}

export function isDoubleMove(moveStr: string): boolean {
  return moveStr.includes("2");
}

export function isQuarterTurnOf(doubleMove: string, move: string): boolean {
  const face = moveFamily(doubleMove);
  return moveFamily(move) === face && !isDoubleMove(move);
}

export function buildMoveString(face: string, amount: number): string {
  return new Move(face, amount).toString();
}

/**
 * Conjugate a single face move by z2: z2 · X · z2 swaps R↔L and U↔D;
 * F and B are unchanged (z2 is a rotation around the F-B axis). Wide
 * moves (r, l, u, d) follow the same rule. Direction (') and double (2)
 * modifiers are preserved.
 */
const Z2_FACE_MAP: Record<string, string> = {
  R: "L", L: "R", U: "D", D: "U", F: "F", B: "B",
  r: "l", l: "r", u: "d", d: "u", f: "f", b: "b",
};

export function conjugateMoveByZ2(move: string): string {
  const match = /^([RLUDFBrludfb])(['2]*)$/.exec(move);
  if (!match) return move; // rotations, slices (M/E/S), etc. — pass through
  const [, face, suffix] = match;
  return (Z2_FACE_MAP[face] ?? face) + suffix;
}

/**
 * Apply z2 conjugation to every token in an algorithm string (space-separated).
 */
export function conjugateAlgByZ2(alg: string): string {
  return alg.split(" ").map(conjugateMoveByZ2).join(" ");
}

/**
 * Collapse consecutive same-face moves into combined notation.
 * e.g. ["R", "R"] → ["R2"], ["R", "R", "R"] → ["R'"], ["U", "U'"] → []
 */
export function collapseMoves(moves: string[]): string[] {
  const result: { face: string; amount: number }[] = [];

  for (const move of moves) {
    const face = moveFamily(move);
    const amount = moveAmount(move);

    if (result.length > 0 && result[result.length - 1].face === face) {
      const combined = normalizeAmount(result[result.length - 1].amount + amount);
      if (combined === 0) {
        result.pop();
      } else {
        result[result.length - 1].amount = combined;
      }
    } else {
      result.push({ face, amount: normalizeAmount(amount) });
    }
  }

  return result.map((e) => buildMoveString(e.face, e.amount));
}
