import { type Color, COLOR_HEX } from "@/core/pll-types";

/**
 * CornerView — SVG rendering of a cube corner with 25° skew, front-biased.
 *
 * Shows two faces of a cube corner. Each face has 3 stickers arranged
 * horizontally (left corner, edge, right corner of the top row).
 * Faces meet at the top ridge and splay outward at the bottom (Λ shape).
 *
 * Props:
 *   stickers: Color[6]
 *     - indices 0-2: left/side face (narrower), left to right
 *     - indices 3-5: right/front face (wider), left to right
 *   size?: number — overall width in px (default 200)
 */

export interface CornerViewProps {
  /** 6 sticker colors: [left0, left1, left2, right0, right1, right2] */
  stickers: readonly Color[];
  /** Overall width in px (default 200) */
  size?: number;
}

// Skew angle in degrees — front-biased means the right face is wider
const SKEW_DEG = 25;
const SKEW_RAD = (SKEW_DEG * Math.PI) / 180;

// Face dimensions
const LEFT_FACE_WIDTH = 36; // narrower side face
const RIGHT_FACE_WIDTH = 54; // wider front face
const FACE_HEIGHT = 44; // height of the sticker strip (single row)
const GAP = 2; // gap between stickers and edges

// The dividing ridge (where the two faces meet) x position
const RIDGE_X = LEFT_FACE_WIDTH + 4;

/**
 * Compute the 4 corner points of a parallelogram sticker on the left face.
 * col 0 = leftmost (furthest from ridge), col 2 = rightmost (nearest ridge).
 */
function leftStickerPoints(col: number): string {
  const faceWidth = LEFT_FACE_WIDTH;
  const stickerW = (faceWidth - GAP * 4) / 3;
  const bottomSkew = FACE_HEIGHT * Math.tan(SKEW_RAD);

  // x positions at top (y=0): face goes from RIDGE_X - faceWidth to RIDGE_X
  // x positions at bottom (y=FACE_HEIGHT): shifted left by bottomSkew
  const topLeft = RIDGE_X - faceWidth;
  const botLeft = RIDGE_X - faceWidth - bottomSkew;

  // Each column: interpolate between top and bottom edges
  const x0Top = topLeft + GAP + col * (stickerW + GAP);
  const x1Top = x0Top + stickerW;
  const x0Bot = botLeft + GAP + col * (stickerW + GAP);
  const x1Bot = x0Bot + stickerW;

  const y0 = GAP;
  const y1 = FACE_HEIGHT - GAP;

  return `${x0Top},${y0} ${x1Top},${y0} ${x1Bot},${y1} ${x0Bot},${y1}`;
}

/**
 * Compute the 4 corner points of a parallelogram sticker on the right face.
 * col 0 = leftmost (nearest ridge), col 2 = rightmost (furthest from ridge).
 */
function rightStickerPoints(col: number): string {
  const faceWidth = RIGHT_FACE_WIDTH;
  const stickerW = (faceWidth - GAP * 4) / 3;
  const bottomSkew = FACE_HEIGHT * Math.tan(SKEW_RAD);

  // x positions at top (y=0): face goes from RIDGE_X to RIDGE_X + faceWidth
  // x positions at bottom (y=FACE_HEIGHT): shifted right by bottomSkew
  const topLeft = RIDGE_X;
  const botLeft = RIDGE_X + bottomSkew;

  const x0Top = topLeft + GAP + col * (stickerW + GAP);
  const x1Top = x0Top + stickerW;
  const x0Bot = botLeft + GAP + col * (stickerW + GAP);
  const x1Bot = x0Bot + stickerW;

  const y0 = GAP;
  const y1 = FACE_HEIGHT - GAP;

  return `${x0Top},${y0} ${x1Top},${y0} ${x1Bot},${y1} ${x0Bot},${y1}`;
}

/** Left face outline (parallelogram) — meets ridge at top, splays at bottom */
function leftFaceOutline(): string {
  const bottomSkew = FACE_HEIGHT * Math.tan(SKEW_RAD);
  const tl = `${RIDGE_X - LEFT_FACE_WIDTH},0`;
  const tr = `${RIDGE_X},0`;
  const br = `${RIDGE_X - bottomSkew},${FACE_HEIGHT}`;
  const bl = `${RIDGE_X - LEFT_FACE_WIDTH - bottomSkew},${FACE_HEIGHT}`;
  return `${tl} ${tr} ${br} ${bl}`;
}

/** Right face outline (parallelogram) — meets ridge at top, splays at bottom */
function rightFaceOutline(): string {
  const bottomSkew = FACE_HEIGHT * Math.tan(SKEW_RAD);
  const tl = `${RIDGE_X},0`;
  const tr = `${RIDGE_X + RIGHT_FACE_WIDTH},0`;
  const br = `${RIDGE_X + RIGHT_FACE_WIDTH + bottomSkew},${FACE_HEIGHT}`;
  const bl = `${RIDGE_X + bottomSkew},${FACE_HEIGHT}`;
  return `${tl} ${tr} ${br} ${bl}`;
}

export function CornerView({ stickers, size = 200 }: CornerViewProps) {
  const bottomSkew = FACE_HEIGHT * Math.tan(SKEW_RAD);
  const minX = RIDGE_X - LEFT_FACE_WIDTH - bottomSkew - 1;
  const maxX = RIDGE_X + RIGHT_FACE_WIDTH + bottomSkew + 1;
  const viewBoxWidth = maxX - minX;
  const viewBoxHeight = FACE_HEIGHT + 2;

  const svgHeight = (viewBoxHeight / viewBoxWidth) * size;

  return (
    <svg
      width={size}
      height={svgHeight}
      viewBox={`${minX} -1 ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-label="Cube corner view"
    >
      {/* Face outlines (dark background) */}
      <polygon
        points={leftFaceOutline()}
        fill="#1a1a1a"
        stroke="#333"
        strokeWidth="1"
      />
      <polygon
        points={rightFaceOutline()}
        fill="#1a1a1a"
        stroke="#333"
        strokeWidth="1"
      />

      {/* Left face stickers (indices 0-2), arranged left to right */}
      {[0, 1, 2].map((col) => (
        <polygon
          key={`left-${col}`}
          points={leftStickerPoints(col)}
          fill={COLOR_HEX[stickers[col]]}
          stroke="#111"
          strokeWidth="0.5"
        />
      ))}

      {/* Right face stickers (indices 3-5), arranged left to right */}
      {[0, 1, 2].map((col) => (
        <polygon
          key={`right-${col}`}
          points={rightStickerPoints(col)}
          fill={COLOR_HEX[stickers[3 + col]]}
          stroke="#111"
          strokeWidth="0.5"
        />
      ))}

      {/* Ridge line (center dividing edge) */}
      <line
        x1={RIDGE_X}
        y1={0}
        x2={RIDGE_X + bottomSkew}
        y2={FACE_HEIGHT}
        stroke="#555"
        strokeWidth="1.5"
      />
    </svg>
  );
}
