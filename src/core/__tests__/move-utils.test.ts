import { describe, it, expect } from "vitest";
import {
  invertMove,
  moveFamily,
  moveAmount,
  normalizeAmount,
  isDoubleMove,
  isQuarterTurnOf,
  buildMoveString,
} from "../move-utils";

describe("move-utils", () => {
  describe("invertMove", () => {
    it("inverts R to R'", () => expect(invertMove("R")).toBe("R'"));
    it("inverts R' to R", () => expect(invertMove("R'")).toBe("R"));
    it("inverts R2 to R2 (self-inverse)", () => expect(invertMove("R2")).toBe("R2"));
    it("inverts U to U'", () => expect(invertMove("U")).toBe("U'"));
    it("inverts D' to D", () => expect(invertMove("D'")).toBe("D"));
  });

  describe("moveFamily", () => {
    it("extracts R from R", () => expect(moveFamily("R")).toBe("R"));
    it("extracts R from R'", () => expect(moveFamily("R'")).toBe("R"));
    it("extracts R from R2", () => expect(moveFamily("R2")).toBe("R"));
    it("extracts U from U", () => expect(moveFamily("U")).toBe("U"));
  });

  describe("moveAmount", () => {
    it("R is 1", () => expect(moveAmount("R")).toBe(1));
    it("R' is -1", () => expect(moveAmount("R'")).toBe(-1));
    it("R2 is 2", () => expect(moveAmount("R2")).toBe(2));
    it("U is 1", () => expect(moveAmount("U")).toBe(1));
  });

  describe("normalizeAmount", () => {
    it("0 stays 0", () => expect(normalizeAmount(0)).toBe(0));
    it("1 stays 1", () => expect(normalizeAmount(1)).toBe(1));
    it("2 stays 2", () => expect(normalizeAmount(2)).toBe(2));
    it("3 becomes -1", () => expect(normalizeAmount(3)).toBe(-1));
    it("4 becomes 0", () => expect(normalizeAmount(4)).toBe(0));
    it("-1 stays -1", () => expect(normalizeAmount(-1)).toBe(-1));
    it("-2 stays 2", () => expect(normalizeAmount(-2)).toBe(2));
  });

  describe("isDoubleMove", () => {
    it("R2 is double", () => expect(isDoubleMove("R2")).toBe(true));
    it("R is not double", () => expect(isDoubleMove("R")).toBe(false));
    it("R' is not double", () => expect(isDoubleMove("R'")).toBe(false));
  });

  describe("isQuarterTurnOf", () => {
    it("R is quarter turn of R2", () => expect(isQuarterTurnOf("R2", "R")).toBe(true));
    it("R' is quarter turn of R2", () => expect(isQuarterTurnOf("R2", "R'")).toBe(true));
    it("U is not quarter turn of R2", () => expect(isQuarterTurnOf("R2", "U")).toBe(false));
  });

  describe("buildMoveString", () => {
    it("R + 1 = R", () => expect(buildMoveString("R", 1)).toBe("R"));
    it("R + -1 = R'", () => expect(buildMoveString("R", -1)).toBe("R'"));
    it("R + 2 = R2", () => expect(buildMoveString("R", 2)).toBe("R2"));
  });
});
