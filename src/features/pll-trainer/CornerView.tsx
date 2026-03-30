import { type Color, COLOR_HEX } from "@/core/pll-types";

/**
 * CornerView — SVG rendering of a cube corner from above.
 *
 * Y-spoke layout: three faces radiate from the corner apex.
 *   - U face (top): wide flat triangle between left and right spokes
 *   - Left side face: trapezoidal sticker band between left spoke and ridge
 *   - Right/front face: trapezoidal sticker band between ridge and right spoke
 *
 * Stickers are quads (trapezoids) within each face band, not pie-slice
 * triangles, so they remain readable even near the corner apex.
 *
 * Props:
 *   stickers: Color[6]
 *     - indices 0-2: left/side face, outer to ridge
 *     - indices 3-5: right/front face, ridge to outer
 *   topColor?: Color — U face color (default "white")
 *   size?: number — overall width in px (default 240)
 */

export interface CornerViewProps {
  stickers: readonly Color[];
  topColor?: Color;
  size?: number;
}

type Pt = { x: number; y: number };

// Y-spoke geometry: three faces meet at the corner apex
const APEX: Pt = { x: 100, y: 5 };
const L: Pt = { x: 18, y: 48 }; // left spoke endpoint
const R: Pt = { x: 192, y: 48 }; // right spoke endpoint (front-biased)
const D: Pt = { x: 100, y: 95 }; // ridge bottom (down spoke)

// Sticker band position along spokes (fraction from apex)
const T_START = 0.3; // leave dark gap near apex for corner plastic
const T_END = 0.92;

const STROKE_W = 1.5;
const STROKE = "#1a1a1a";

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pts(...pp: Pt[]): string {
  return pp.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/** Compute a sticker quadrilateral within a face's trapezoidal band. */
function stickerQuad(endA: Pt, endB: Pt, col: number): string {
  const tA = lerp(APEX, endA, T_START);
  const tB = lerp(APEX, endB, T_START);
  const bA = lerp(APEX, endA, T_END);
  const bB = lerp(APEX, endB, T_END);

  return pts(
    lerp(tA, tB, col / 3),
    lerp(tA, tB, (col + 1) / 3),
    lerp(bA, bB, (col + 1) / 3),
    lerp(bA, bB, col / 3),
  );
}

export function CornerView({
  stickers,
  topColor = "white",
  size = 240,
}: CornerViewProps) {
  const PAD = 2;
  const minX = L.x - PAD;
  const maxX = R.x + PAD;
  const minY = APEX.y - PAD;
  const maxY = D.y + PAD;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  return (
    <svg
      width={size}
      height={(vbH / vbW) * size}
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      role="img"
      aria-label="Cube corner view"
    >
      {/* Dark background — black plastic of the corner piece */}
      <polygon points={pts(APEX, L, D)} fill="#1a1a1a" />
      <polygon points={pts(APEX, D, R)} fill="#1a1a1a" />

      {/* U face — solid color triangle */}
      <polygon
        points={pts(APEX, L, R)}
        fill={COLOR_HEX[topColor]}
        stroke={STROKE}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
      />

      {/* Left face stickers (indices 0-2, outer→ridge) */}
      {[0, 1, 2].map((col) => (
        <polygon
          key={`l${col}`}
          points={stickerQuad(L, D, col)}
          fill={COLOR_HEX[stickers[col]]}
          stroke={STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
      ))}

      {/* Right face stickers (indices 3-5, ridge→outer) */}
      {[0, 1, 2].map((col) => (
        <polygon
          key={`r${col}`}
          points={stickerQuad(D, R, col)}
          fill={COLOR_HEX[stickers[3 + col]]}
          stroke={STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
