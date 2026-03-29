import { type Color, COLOR_HEX } from "@/core/pll-types";

/**
 * CornerView — SVG rendering of a cube corner from above.
 *
 * Shows the U face as a triangle at the top (solid color), with two
 * side face sticker strips below forming a tent/A-frame shape.
 * The right (front) face is wider for a front-biased perspective.
 *
 * Props:
 *   stickers: Color[6]
 *     - indices 0-2: left/side face, left to right
 *     - indices 3-5: right/front face, left to right
 *   topColor?: Color — U face color (default "white")
 *   size?: number — overall width in px (default 240)
 */

export interface CornerViewProps {
  stickers: readonly Color[];
  topColor?: Color;
  size?: number;
}

// Layout constants
const RIDGE_X = 95; // x of the ridge / corner vertex
const CORNER_Y = 6; // y of corner vertex (topmost point)
const STRIP_TOP_Y = 30; // where side face strips begin
const STRIP_BOT_Y = 70; // where side face strips end
const LEFT_TOP_W = 48; // left face width at strip top
const RIGHT_TOP_W = 68; // right face width at strip top (front-biased)
const SPLAY = 0.3; // outward splay per pixel of strip height
const GAP = 1.5;

// Derived
const STRIP_H = STRIP_BOT_Y - STRIP_TOP_Y;
const LEFT_BOT_W = LEFT_TOP_W + STRIP_H * SPLAY;
const RIGHT_BOT_W = RIGHT_TOP_W + STRIP_H * SPLAY;

// Key points
const TOP_LEFT = { x: RIDGE_X - LEFT_TOP_W, y: STRIP_TOP_Y };
const TOP_RIGHT = { x: RIDGE_X + RIGHT_TOP_W, y: STRIP_TOP_Y };
const BOT_LEFT = { x: RIDGE_X - LEFT_BOT_W, y: STRIP_BOT_Y };
const BOT_RIGHT = { x: RIDGE_X + RIGHT_BOT_W, y: STRIP_BOT_Y };

function topFacePoints(): string {
  return `${RIDGE_X},${CORNER_Y} ${TOP_LEFT.x},${TOP_LEFT.y} ${TOP_RIGHT.x},${TOP_RIGHT.y}`;
}

function leftFaceOutline(): string {
  return `${TOP_LEFT.x},${TOP_LEFT.y} ${RIDGE_X},${STRIP_TOP_Y} ${RIDGE_X},${STRIP_BOT_Y} ${BOT_LEFT.x},${BOT_LEFT.y}`;
}

function rightFaceOutline(): string {
  return `${RIDGE_X},${STRIP_TOP_Y} ${TOP_RIGHT.x},${TOP_RIGHT.y} ${BOT_RIGHT.x},${BOT_RIGHT.y} ${RIDGE_X},${STRIP_BOT_Y}`;
}

/**
 * Compute sticker quadrilateral within the left face strip.
 * col 0 = leftmost (outer), col 2 = rightmost (near ridge).
 */
function leftStickerPoints(col: number): string {
  const topW = LEFT_TOP_W;
  const botW = LEFT_BOT_W;
  const topSW = (topW - GAP * 4) / 3;
  const botSW = (botW - GAP * 4) / 3;

  const y0 = STRIP_TOP_Y + GAP;
  const y1 = STRIP_BOT_Y - GAP;

  const topOuter = RIDGE_X - topW;
  const botOuter = RIDGE_X - botW;

  const x0TopL = topOuter + GAP + col * (topSW + GAP);
  const x0TopR = x0TopL + topSW;
  const x0BotL = botOuter + GAP + col * (botSW + GAP);
  const x0BotR = x0BotL + botSW;

  return `${x0TopL},${y0} ${x0TopR},${y0} ${x0BotR},${y1} ${x0BotL},${y1}`;
}

/**
 * Compute sticker quadrilateral within the right face strip.
 * col 0 = leftmost (near ridge), col 2 = rightmost (outer).
 */
function rightStickerPoints(col: number): string {
  const topW = RIGHT_TOP_W;
  const botW = RIGHT_BOT_W;
  const topSW = (topW - GAP * 4) / 3;
  const botSW = (botW - GAP * 4) / 3;

  const y0 = STRIP_TOP_Y + GAP;
  const y1 = STRIP_BOT_Y - GAP;

  const x0TopL = RIDGE_X + GAP + col * (topSW + GAP);
  const x0TopR = x0TopL + topSW;
  const x0BotL = RIDGE_X + GAP + col * (botSW + GAP);
  const x0BotR = x0BotL + botSW;

  return `${x0TopL},${y0} ${x0TopR},${y0} ${x0BotR},${y1} ${x0BotL},${y1}`;
}

export function CornerView({
  stickers,
  topColor = "white",
  size = 240,
}: CornerViewProps) {
  const minX = BOT_LEFT.x - 2;
  const maxX = BOT_RIGHT.x + 2;
  const viewBoxWidth = maxX - minX;
  const viewBoxHeight = STRIP_BOT_Y - CORNER_Y + 4;
  const svgHeight = (viewBoxHeight / viewBoxWidth) * size;

  return (
    <svg
      width={size}
      height={svgHeight}
      viewBox={`${minX} ${CORNER_Y - 2} ${viewBoxWidth} ${viewBoxHeight}`}
      role="img"
      aria-label="Cube corner view"
    >
      {/* Top (U) face — solid color triangle */}
      <polygon
        points={topFacePoints()}
        fill={COLOR_HEX[topColor]}
        stroke="#333"
        strokeWidth="0.8"
      />

      {/* Side face outlines */}
      <polygon
        points={leftFaceOutline()}
        fill="#1a1a1a"
        stroke="#333"
        strokeWidth="0.8"
      />
      <polygon
        points={rightFaceOutline()}
        fill="#1a1a1a"
        stroke="#333"
        strokeWidth="0.8"
      />

      {/* Left face stickers (indices 0-2) */}
      {[0, 1, 2].map((col) => (
        <polygon
          key={`left-${col}`}
          points={leftStickerPoints(col)}
          fill={COLOR_HEX[stickers[col]]}
          stroke="#111"
          strokeWidth="0.5"
        />
      ))}

      {/* Right face stickers (indices 3-5) */}
      {[0, 1, 2].map((col) => (
        <polygon
          key={`right-${col}`}
          points={rightStickerPoints(col)}
          fill={COLOR_HEX[stickers[3 + col]]}
          stroke="#111"
          strokeWidth="0.5"
        />
      ))}

      {/* Ridge line */}
      <line
        x1={RIDGE_X}
        y1={STRIP_TOP_Y}
        x2={RIDGE_X}
        y2={STRIP_BOT_Y}
        stroke="#555"
        strokeWidth="1.2"
      />
    </svg>
  );
}
