import { type Color, COLOR_HEX } from "@/core/pll-types";

/**
 * CornerView — SVG rendering of a cube corner from above.
 *
 * Three triangular faces radiate from the corner apex in a Y-shape:
 *   - U face (top): wide flat triangle between left and right spokes
 *   - Left side face: triangle between left spoke and ridge (down spoke)
 *   - Right/front face: triangle between ridge and right spoke (wider, front-biased)
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

// Y-spoke geometry: three faces meet at the corner apex
const APEX = { x: 100, y: 5 };
const L = { x: 15, y: 50 }; // left spoke endpoint
const R = { x: 195, y: 50 }; // right spoke endpoint (front-biased, wider)
const D = { x: 100, y: 98 }; // ridge bottom (down spoke)

const STROKE_W = 1.5;
const STROKE_COLOR = "#1a1a1a";

type Pt = { x: number; y: number };

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pts(...points: Pt[]): string {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
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
      {/* U face — solid color triangle */}
      <polygon
        points={pts(APEX, L, R)}
        fill={COLOR_HEX[topColor]}
        stroke={STROKE_COLOR}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
      />

      {/* Left face stickers (indices 0-2, outer→ridge) */}
      {[0, 1, 2].map((col) => (
        <polygon
          key={`l${col}`}
          points={pts(APEX, lerp(L, D, col / 3), lerp(L, D, (col + 1) / 3))}
          fill={COLOR_HEX[stickers[col]]}
          stroke={STROKE_COLOR}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
      ))}

      {/* Right face stickers (indices 3-5, ridge→outer) */}
      {[0, 1, 2].map((col) => (
        <polygon
          key={`r${col}`}
          points={pts(APEX, lerp(D, R, col / 3), lerp(D, R, (col + 1) / 3))}
          fill={COLOR_HEX[stickers[3 + col]]}
          stroke={STROKE_COLOR}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
