import { type Color, COLOR_HEX } from "@/core/pll-types";

/**
 * CornerView — SVG rendering of a cube corner with 25° skew, front-biased.
 *
 * Shows two faces of a cube corner: a narrower left/side face and a wider
 * right/front face. Each face has 3 stickers arranged vertically (top row
 * of that face's column visible from the corner angle).
 *
 * Props:
 *   stickers: Color[6]
 *     - indices 0-2: left/side face (narrower), top to bottom
 *     - indices 3-5: right/front face (wider), top to bottom
 *   size?: number — overall width in px (default 120)
 */

export interface CornerViewProps {
  /** 6 sticker colors: [left0, left1, left2, right0, right1, right2] */
  stickers: readonly Color[];
  /** Overall width in px (default 120) */
  size?: number;
}

// Layout constants (in SVG coordinate space)
const SVG_WIDTH = 120;
const SVG_HEIGHT = 100;

// Skew angle in degrees — front-biased means the right face is wider
const SKEW_DEG = 25;
const SKEW_RAD = (SKEW_DEG * Math.PI) / 180;

// Face dimensions
const LEFT_FACE_WIDTH = 30; // narrower side face
const RIGHT_FACE_WIDTH = 50; // wider front face
const FACE_HEIGHT = 80;
const STICKER_GAP = 2;

// Sticker dimensions
const LEFT_STICKER_W = LEFT_FACE_WIDTH - STICKER_GAP * 2;
const RIGHT_STICKER_W = RIGHT_FACE_WIDTH - STICKER_GAP * 2;
const STICKER_H = (FACE_HEIGHT - STICKER_GAP * 4) / 3;

// The dividing ridge (where the two faces meet) x position
const RIDGE_X = LEFT_FACE_WIDTH + 5;

/**
 * Compute the 4 corner points of a parallelogram sticker on the left face.
 * Left face: top meets the ridge, bottom splays outward (Λ shape).
 */
function leftStickerPoints(row: number): string {
  const y0 = STICKER_GAP + row * (STICKER_H + STICKER_GAP);
  const y1 = y0 + STICKER_H;

  // Horizontal offset due to skew: lower rows shift more to the left
  const skewOffset0 = y0 * Math.tan(SKEW_RAD);
  const skewOffset1 = y1 * Math.tan(SKEW_RAD);

  const x0Left = RIDGE_X - LEFT_FACE_WIDTH - skewOffset0 + STICKER_GAP;
  const x0Right = RIDGE_X - skewOffset0 - STICKER_GAP;
  const x1Left = RIDGE_X - LEFT_FACE_WIDTH - skewOffset1 + STICKER_GAP;
  const x1Right = RIDGE_X - skewOffset1 - STICKER_GAP;

  return `${x0Left},${y0} ${x0Right},${y0} ${x1Right},${y1} ${x1Left},${y1}`;
}

/**
 * Compute the 4 corner points of a parallelogram sticker on the right face.
 * Right face: top meets the ridge, bottom splays outward (Λ shape).
 */
function rightStickerPoints(row: number): string {
  const y0 = STICKER_GAP + row * (STICKER_H + STICKER_GAP);
  const y1 = y0 + STICKER_H;

  const skewOffset0 = y0 * Math.tan(SKEW_RAD);
  const skewOffset1 = y1 * Math.tan(SKEW_RAD);

  const x0Left = RIDGE_X + skewOffset0 + STICKER_GAP;
  const x0Right = RIDGE_X + RIGHT_FACE_WIDTH + skewOffset0 - STICKER_GAP;
  const x1Left = RIDGE_X + skewOffset1 + STICKER_GAP;
  const x1Right = RIDGE_X + RIGHT_FACE_WIDTH + skewOffset1 - STICKER_GAP;

  return `${x0Left},${y0} ${x0Right},${y0} ${x1Right},${y1} ${x1Left},${y1}`;
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

export function CornerView({ stickers, size = 120 }: CornerViewProps) {
  // Compute actual viewBox bounds to center the content
  const bottomSkew = FACE_HEIGHT * Math.tan(SKEW_RAD);
  const minX = RIDGE_X - LEFT_FACE_WIDTH - bottomSkew - 1;
  const maxX = RIDGE_X + RIGHT_FACE_WIDTH + bottomSkew + 1;
  const viewBoxWidth = maxX - minX;
  const viewBoxHeight = FACE_HEIGHT + 2;

  const scale = size / SVG_WIDTH;
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

      {/* Left face stickers (indices 0-2) */}
      {[0, 1, 2].map((row) => (
        <polygon
          key={`left-${row}`}
          points={leftStickerPoints(row)}
          fill={COLOR_HEX[stickers[row]]}
          stroke="#111"
          strokeWidth="0.5"
        />
      ))}

      {/* Right face stickers (indices 3-5) */}
      {[0, 1, 2].map((row) => (
        <polygon
          key={`right-${row}`}
          points={rightStickerPoints(row)}
          fill={COLOR_HEX[stickers[3 + row]]}
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
