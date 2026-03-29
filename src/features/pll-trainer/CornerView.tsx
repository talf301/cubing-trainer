import { type Color, COLOR_HEX } from "@/core/pll-types";

/**
 * CornerView — SVG rendering of a cube corner with 25° skew, front-biased.
 *
 * Shows two faces of a cube corner. Each face has 3 stickers arranged
 * horizontally (left corner, edge, right corner of the top row).
 * Faces meet at the ridge (shared inner edge) and the outer edges
 * splay outward at the bottom, forming a Λ shape.
 *
 * Props:
 *   stickers: Color[6]
 *     - indices 0-2: left/side face (narrower), left to right
 *     - indices 3-5: right/front face (wider), left to right
 *   size?: number — overall width in px (default 200)
 */

export interface CornerViewProps {
  stickers: readonly Color[];
  size?: number;
}

const SKEW_DEG = 25;
const SKEW_RAD = (SKEW_DEG * Math.PI) / 180;

const LEFT_FACE_WIDTH = 36;
const RIGHT_FACE_WIDTH = 54;
const FACE_HEIGHT = 44;
const GAP = 2;

// Ridge x position — the shared inner edge of both faces
const RIDGE_X = LEFT_FACE_WIDTH + 4;

/**
 * Interpolate x between top and bottom of a face for a given y.
 * Each face is a trapezoid: inner edge is vertical (ridge),
 * outer edge splays outward at the bottom.
 */
function lerp(topX: number, botX: number, y: number): number {
  return topX + (botX - topX) * (y / FACE_HEIGHT);
}

/**
 * Compute sticker parallelogram for the left face.
 * The face goes from the ridge (right edge, vertical) to the outer edge (splays left).
 * col 0 = leftmost (outer), col 2 = rightmost (near ridge).
 */
function leftStickerPoints(col: number): string {
  const bottomSkew = FACE_HEIGHT * Math.tan(SKEW_RAD);
  const topOuter = RIDGE_X - LEFT_FACE_WIDTH;
  const botOuter = RIDGE_X - LEFT_FACE_WIDTH - bottomSkew;

  // At top: face width = LEFT_FACE_WIDTH, stickers divide it
  // At bottom: face width = LEFT_FACE_WIDTH + bottomSkew
  const stickerFrac0 = (GAP + col * (1 / 3)) / 1; // not quite — need proportional
  // Divide face into 3 equal columns with gaps, proportionally at top and bottom
  const topW = LEFT_FACE_WIDTH;
  const botW = LEFT_FACE_WIDTH + bottomSkew;
  const topStickerW = (topW - GAP * 4) / 3;
  const botStickerW = (botW - GAP * 4) / 3;

  const y0 = GAP;
  const y1 = FACE_HEIGHT - GAP;

  const x0TopL = topOuter + GAP + col * (topStickerW + GAP);
  const x0TopR = x0TopL + topStickerW;
  const x0BotL = botOuter + GAP + col * (botStickerW + GAP);
  const x0BotR = x0BotL + botStickerW;

  return `${x0TopL},${y0} ${x0TopR},${y0} ${x0BotR},${y1} ${x0BotL},${y1}`;
}

/**
 * Compute sticker parallelogram for the right face.
 * The face goes from the ridge (left edge, vertical) to the outer edge (splays right).
 * col 0 = leftmost (near ridge), col 2 = rightmost (outer).
 */
function rightStickerPoints(col: number): string {
  const bottomSkew = FACE_HEIGHT * Math.tan(SKEW_RAD);

  const topW = RIGHT_FACE_WIDTH;
  const botW = RIGHT_FACE_WIDTH + bottomSkew;
  const topStickerW = (topW - GAP * 4) / 3;
  const botStickerW = (botW - GAP * 4) / 3;

  const y0 = GAP;
  const y1 = FACE_HEIGHT - GAP;

  const x0TopL = RIDGE_X + GAP + col * (topStickerW + GAP);
  const x0TopR = x0TopL + topStickerW;
  const x0BotL = RIDGE_X + GAP + col * (botStickerW + GAP);
  const x0BotR = x0BotL + botStickerW;

  return `${x0TopL},${y0} ${x0TopR},${y0} ${x0BotR},${y1} ${x0BotL},${y1}`;
}

function leftFaceOutline(): string {
  const bottomSkew = FACE_HEIGHT * Math.tan(SKEW_RAD);
  const tl = `${RIDGE_X - LEFT_FACE_WIDTH},0`;
  const tr = `${RIDGE_X},0`;
  const br = `${RIDGE_X},${FACE_HEIGHT}`;
  const bl = `${RIDGE_X - LEFT_FACE_WIDTH - bottomSkew},${FACE_HEIGHT}`;
  return `${tl} ${tr} ${br} ${bl}`;
}

function rightFaceOutline(): string {
  const bottomSkew = FACE_HEIGHT * Math.tan(SKEW_RAD);
  const tl = `${RIDGE_X},0`;
  const tr = `${RIDGE_X + RIGHT_FACE_WIDTH},0`;
  const br = `${RIDGE_X + RIGHT_FACE_WIDTH + bottomSkew},${FACE_HEIGHT}`;
  const bl = `${RIDGE_X},${FACE_HEIGHT}`;
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

      {[0, 1, 2].map((col) => (
        <polygon
          key={`left-${col}`}
          points={leftStickerPoints(col)}
          fill={COLOR_HEX[stickers[col]]}
          stroke="#111"
          strokeWidth="0.5"
        />
      ))}

      {[0, 1, 2].map((col) => (
        <polygon
          key={`right-${col}`}
          points={rightStickerPoints(col)}
          fill={COLOR_HEX[stickers[3 + col]]}
          stroke="#111"
          strokeWidth="0.5"
        />
      ))}

      <line
        x1={RIDGE_X}
        y1={0}
        x2={RIDGE_X}
        y2={FACE_HEIGHT}
        stroke="#555"
        strokeWidth="1.5"
      />
    </svg>
  );
}
