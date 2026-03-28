import { type OverheadStickers, COLOR_HEX } from "@/core/pll-types";

/**
 * OverheadPllDiagram — standard top-down PLL view.
 *
 * Shows the U face as a 3x3 grid with the top row of each side face
 * (front, right, back, left) around the edges, forming the classic
 * PLL diagram used in speedcubing resources.
 *
 * Layout (SVG coordinates):
 *
 *              [B2] [B1] [B0]        ← back (reversed for top-down)
 *         [L0]  U0   U1   U2  [R2]
 *         [L1]  U3   U4   U5  [R1]
 *         [L2]  U6   U7   U8  [R0]
 *              [F0] [F1] [F2]        ← front
 */

export interface OverheadPllDiagramProps {
  stickers: OverheadStickers;
  /** Overall width in px (default 160) */
  size?: number;
}

// Layout constants (SVG coordinate space)
const CELL = 24; // sticker size
const GAP = 2; // gap between stickers
const SIDE_DEPTH = 10; // depth of side face strips
const SIDE_GAP = 2; // gap between side strip and U face
const BORDER = 1; // padding around the whole diagram

// U face grid origin (top-left of U face area)
const U_X = BORDER + SIDE_DEPTH + SIDE_GAP;
const U_Y = BORDER + SIDE_DEPTH + SIDE_GAP;

// Total grid size for U face
const GRID = CELL * 3 + GAP * 2;

// Total SVG dimensions
const SVG_SIZE = BORDER * 2 + SIDE_DEPTH * 2 + SIDE_GAP * 2 + GRID;

function stickerRect(
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  key: string,
) {
  return (
    <rect
      key={key}
      x={x}
      y={y}
      width={w}
      height={h}
      rx={2}
      fill={color}
      stroke="#111"
      strokeWidth="0.5"
    />
  );
}

export function OverheadPllDiagram({
  stickers,
  size = 160,
}: OverheadPllDiagramProps) {
  const elements: JSX.Element[] = [];

  // U face background
  elements.push(
    <rect
      key="u-bg"
      x={U_X - 1}
      y={U_Y - 1}
      width={GRID + 2}
      height={GRID + 2}
      fill="#1a1a1a"
      stroke="#333"
      strokeWidth="1"
      rx={1}
    />,
  );

  // U face 3x3 grid
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const x = U_X + col * (CELL + GAP);
      const y = U_Y + row * (CELL + GAP);
      elements.push(
        stickerRect(x, y, CELL, CELL, COLOR_HEX[stickers.u[idx]], `u-${idx}`),
      );
    }
  }

  // Front face top row (below U face)
  const frontY = U_Y + GRID + SIDE_GAP;
  for (let i = 0; i < 3; i++) {
    const x = U_X + i * (CELL + GAP);
    elements.push(
      stickerRect(
        x,
        frontY,
        CELL,
        SIDE_DEPTH,
        COLOR_HEX[stickers.front[i]],
        `f-${i}`,
      ),
    );
  }

  // Back face top row (above U face, reversed for top-down perspective)
  const backY = BORDER;
  for (let i = 0; i < 3; i++) {
    // Reverse order: when looking down, back face reads right-to-left
    const x = U_X + (2 - i) * (CELL + GAP);
    elements.push(
      stickerRect(
        x,
        backY,
        CELL,
        SIDE_DEPTH,
        COLOR_HEX[stickers.back[i]],
        `b-${i}`,
      ),
    );
  }

  // Right face top row (to the right of U face)
  const rightX = U_X + GRID + SIDE_GAP;
  for (let i = 0; i < 3; i++) {
    // Reverse order: when looking down, right face reads bottom-to-top
    const y = U_Y + (2 - i) * (CELL + GAP);
    elements.push(
      stickerRect(
        rightX,
        y,
        SIDE_DEPTH,
        CELL,
        COLOR_HEX[stickers.right[i]],
        `r-${i}`,
      ),
    );
  }

  // Left face top row (to the left of U face)
  const leftX = BORDER;
  for (let i = 0; i < 3; i++) {
    const y = U_Y + i * (CELL + GAP);
    elements.push(
      stickerRect(
        leftX,
        y,
        SIDE_DEPTH,
        CELL,
        COLOR_HEX[stickers.left[i]],
        `l-${i}`,
      ),
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
      role="img"
      aria-label="PLL overhead diagram"
    >
      {elements}
    </svg>
  );
}
