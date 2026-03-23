import { Alg, Move } from "cubing/alg";

/**
 * Normalize a move amount to the range [-1, 0, 1, 2].
 * On a 3x3, R3 = R', R4 = identity, etc.
 */
function normalizeAmount(amount: number): number {
  const mod = ((amount % 4) + 4) % 4; // always 0–3
  if (mod === 3) return -1; // R3 = R'
  if (mod === 0) return 0;  // R4 = identity
  return mod; // 1 or 2
}

/**
 * Get the "family key" for a move that determines if two moves operate
 * on the same face/layer and can be collapsed.
 */
function moveFamily(move: Move): string {
  const outer = move.outerLayer;
  const inner = move.innerLayer;
  let key = move.family;
  if (outer != null) key = `${outer}-${key}`;
  if (inner != null) key = `${inner}-${key}`;
  return key;
}

/**
 * Compute the algorithm that undoes a sequence of moves.
 *
 * Takes an array of move strings (e.g. ["R", "U", "R'", "U'"]),
 * reverses them, inverts each one, and collapses consecutive
 * same-face moves (e.g. R R → R2, R R' → identity).
 *
 * Returns an Alg representing the undo sequence.
 */
export function computeUndoAlg(moves: string[]): Alg {
  if (moves.length === 0) return new Alg();

  // Reverse and invert each move
  const inverted: Move[] = [];
  for (let i = moves.length - 1; i >= 0; i--) {
    inverted.push(new Move(moves[i]).invert());
  }

  // Collapse consecutive same-face moves
  const collapsed: Move[] = [];
  for (const move of inverted) {
    if (collapsed.length > 0) {
      const prev = collapsed[collapsed.length - 1];
      if (moveFamily(prev) === moveFamily(move)) {
        const combined = normalizeAmount(prev.amount + move.amount);
        if (combined === 0) {
          // Moves cancel out
          collapsed.pop();
        } else {
          collapsed[collapsed.length - 1] = new Move(
            move.quantum,
            combined,
          );
        }
        continue;
      }
    }
    collapsed.push(move);
  }

  return new Alg(collapsed);
}
