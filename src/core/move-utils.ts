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
  return moveStr.endsWith("2");
}

export function isQuarterTurnOf(doubleMove: string, move: string): boolean {
  const face = moveFamily(doubleMove);
  return moveFamily(move) === face && !isDoubleMove(move);
}

export function buildMoveString(face: string, amount: number): string {
  return new Move(face, amount).toString();
}
