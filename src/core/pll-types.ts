/**
 * Standard Rubik's cube face colors.
 * Matches the Western color scheme (white opposite yellow, etc.)
 */
export type Color = "white" | "yellow" | "red" | "orange" | "blue" | "green" | "gray";

/** Hex values for rendering each Color in SVG */
export const COLOR_HEX: Record<Color, string> = {
  white: "#FFFFFF",
  yellow: "#FFD500",
  red: "#C41E3A",
  orange: "#FF5800",
  blue: "#0051BA",
  green: "#009E60",
  gray: "#808080",
};

/**
 * Sticker data for OverheadPllDiagram.
 * Standard top-down PLL view: U face 3x3 + top row of each side face.
 *
 * U face indices (row-major, looking down):
 *   0 1 2
 *   3 4 5
 *   6 7 8
 *
 * Side face top rows (3 stickers each, left to right when facing that side):
 *   front: 9 10 11
 *   right: 12 13 14
 *   back:  15 16 17
 *   left:  18 19 20
 */
export interface OverheadStickers {
  /** U face stickers, row-major (9 values) */
  u: readonly Color[];
  /** Front face top row (3 values, left to right) */
  front: readonly Color[];
  /** Right face top row (3 values, left to right) */
  right: readonly Color[];
  /** Back face top row (3 values, left to right) */
  back: readonly Color[];
  /** Left face top row (3 values, left to right) */
  left: readonly Color[];
}
