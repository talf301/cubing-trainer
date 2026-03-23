import { describe, it, expect } from "vitest";
import { computeUndoAlg } from "../undo-alg";

describe("computeUndoAlg", () => {
  it("returns empty alg for empty moves", () => {
    const result = computeUndoAlg([]);
    expect(result.toString()).toBe("");
  });

  it("inverts a single move", () => {
    const result = computeUndoAlg(["R"]);
    expect(result.toString()).toBe("R'");
  });

  it("reverses and inverts multiple moves", () => {
    // Undo of R U F is F' U' R'
    const result = computeUndoAlg(["R", "U", "F"]);
    expect(result.toString()).toBe("F' U' R'");
  });

  it("handles prime moves", () => {
    // Undo of R' U' is U R
    const result = computeUndoAlg(["R'", "U'"]);
    expect(result.toString()).toBe("U R");
  });

  it("handles double moves", () => {
    // Undo of R2 is R2' (inverse of R2; equivalent on 3x3)
    const result = computeUndoAlg(["R2"]);
    expect(result.toString()).toBe("R2'");
  });

  it("collapses consecutive same-face moves", () => {
    // Undo of R R is R' R' = R2' = R2
    const result = computeUndoAlg(["R", "R"]);
    expect(result.toString()).toBe("R2");
  });

  it("cancels opposite same-face moves", () => {
    // Undo of [U, R, R'] reverses to [R, R', U'] → R R' cancel → U'
    const result = computeUndoAlg(["U", "R", "R'"]);
    expect(result.toString()).toBe("U'");
  });

  it("collapses R R R into R (three quarter turns)", () => {
    // Undo of R R R (= R') is R. R' R' R' collapses to amount -3, normalized to 1 = R
    const result = computeUndoAlg(["R", "R", "R"]);
    expect(result.toString()).toBe("R");
  });

  it("cancels four same-face moves to identity", () => {
    // Undo of R R R R = R' R' R' R' = identity
    const result = computeUndoAlg(["R", "R", "R", "R"]);
    expect(result.toString()).toBe("");
  });

  it("does not collapse different faces", () => {
    const result = computeUndoAlg(["R", "U"]);
    expect(result.toString()).toBe("U' R'");
  });

  it("handles mixed moves with collapsing", () => {
    // Input: R U U → reversed+inverted: U' U' R' → collapse U' U' → U2 R'
    // Wait: reversed is [U, U, R], inverted is [U', U', R']
    // Collapse: U' U' = U2, then R' stays → U2 R'
    const result = computeUndoAlg(["R", "U", "U"]);
    expect(result.toString()).toBe("U2 R'");
  });
});
