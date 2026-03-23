import {
  invertMove,
  moveFamily,
  moveAmount,
  normalizeAmount,
  isDoubleMove,
  isQuarterTurnOf,
  buildMoveString,
} from "./move-utils";

export interface MoveGuideState {
  mode: "tracking" | "recovering";
  position: number;
  isComplete: boolean;
  pendingHalfMove: boolean;
  recoveryMoves: string[];
}

interface ErrorEntry {
  face: string;
  amount: number;
}

export class MoveGuide {
  private moves: string[];
  private _position: number = 0;
  private errorStack: ErrorEntry[] = [];
  private _pendingHalfMove: string | null = null;
  private _pendingRecoveryHalf: string | null = null;

  constructor(moves: string[]) {
    this.moves = moves;
  }

  get state(): MoveGuideState {
    return {
      mode: this.errorStack.length > 0 ? "recovering" : "tracking",
      position: this._position,
      isComplete: this._position >= this.moves.length && this.errorStack.length === 0,
      pendingHalfMove: this._pendingHalfMove !== null || this._pendingRecoveryHalf !== null,
      recoveryMoves: this.errorStack
        .slice()
        .reverse()
        .map((e) => invertMove(buildMoveString(e.face, e.amount))),
    };
  }

  get expectedMove(): string | null {
    if (this.errorStack.length > 0) {
      const top = this.errorStack[this.errorStack.length - 1];
      return invertMove(buildMoveString(top.face, top.amount));
    }
    if (this._position >= this.moves.length) return null;
    return this.moves[this._position];
  }

  onMove(move: string): void {
    if (this.errorStack.length > 0) {
      this.handleRecoveryMove(move);
    } else {
      this.handleTrackingMove(move);
    }
  }

  reset(): void {
    this._position = 0;
    this.errorStack = [];
    this._pendingHalfMove = null;
    this._pendingRecoveryHalf = null;
  }

  private handleTrackingMove(move: string): void {
    if (this._position >= this.moves.length) return;

    const expected = this.moves[this._position];

    if (this._pendingHalfMove !== null) {
      if (move === this._pendingHalfMove) {
        this._pendingHalfMove = null;
        this._position++;
      } else {
        const firstMove = this._pendingHalfMove;
        this._pendingHalfMove = null;
        // Push both moves directly without cross-cancellation between them.
        // The user made a partial double-move attempt (e.g. R then R'), so
        // we record each independently rather than letting them cancel out.
        this.errorStack.push({
          face: moveFamily(firstMove),
          amount: normalizeAmount(moveAmount(firstMove)),
        });
        this.errorStack.push({
          face: moveFamily(move),
          amount: normalizeAmount(moveAmount(move)),
        });
      }
    } else if (move === expected) {
      this._position++;
    } else if (isDoubleMove(expected) && isQuarterTurnOf(expected, move)) {
      this._pendingHalfMove = move;
    } else {
      this.pushError(move);
    }
  }

  private handleRecoveryMove(move: string): void {
    const top = this.errorStack[this.errorStack.length - 1];
    const requiredMove = invertMove(buildMoveString(top.face, top.amount));

    if (this._pendingRecoveryHalf !== null) {
      if (move === this._pendingRecoveryHalf) {
        this._pendingRecoveryHalf = null;
        this.errorStack.pop();
      } else {
        // Stack entry was already updated to reflect the partial recovery,
        // so only the wrong move is a new error (don't re-push the first half)
        this._pendingRecoveryHalf = null;
        this.pushError(move);
      }
    } else if (move === requiredMove) {
      this.errorStack.pop();
    } else if (isDoubleMove(requiredMove) && isQuarterTurnOf(requiredMove, move)) {
      // Partially undo the double-move error: update the stack entry to reflect
      // the net accumulated error after this quarter turn
      const newAmount = normalizeAmount(top.amount + moveAmount(move));
      top.amount = newAmount;
      this._pendingRecoveryHalf = move;
    } else {
      this.pushError(move);
    }
  }

  private pushError(move: string): void {
    const face = moveFamily(move);
    const amount = moveAmount(move);

    if (this.errorStack.length > 0) {
      const top = this.errorStack[this.errorStack.length - 1];
      if (top.face === face) {
        const combined = normalizeAmount(top.amount + amount);
        if (combined === 0) {
          this.errorStack.pop();
        } else {
          top.amount = combined;
        }
        return;
      }
    }

    this.errorStack.push({ face, amount: normalizeAmount(amount) });
  }
}
