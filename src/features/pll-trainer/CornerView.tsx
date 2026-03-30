import { type Color, COLOR_HEX } from "@/core/pll-types";

/**
 * CornerView — SVG rendering of a cube corner from above.
 *
 * Y-spoke layout with parallelogram stickers:
 *   - U face (top): wide flat triangle between left and right spokes
 *   - Left side face: 3 parallelogram stickers along the APEX→L edge
 *   - Right/front face: 3 parallelogram stickers along the APEX→R edge
 *
 * Each sticker is a parallelogram: positioned along the face's top edge
 * and offset downward by a uniform vector (like real cube stickers in
 * isometric projection).
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

// Sticker depth: fraction of APEX→D vector
const DEPTH = 0.25;
const DOWN: Pt = {
  x: (D.x - APEX.x) * DEPTH,
  y: (D.y - APEX.y) * DEPTH,
};

const STROKE_W = 1.5;
const STROKE = "#1a1a1a";

function lerp(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function offset(p: Pt): Pt {
  return { x: p.x + DOWN.x, y: p.y + DOWN.y };
}

function pts(...pp: Pt[]): string {
  return pp.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

/** Parallelogram sticker along a face's top edge, offset downward. */
function stickerPgram(from: Pt, to: Pt, col: number): string {
  const GAP = 0.02;
  const f0 = GAP + (col * (1 - 2 * GAP)) / 3;
  const f1 = GAP + ((col + 1) * (1 - 2 * GAP)) / 3;

  const tl = lerp(from, to, f0);
  const tr = lerp(from, to, f1);
  return pts(tl, tr, offset(tr), offset(tl));
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
      {/* Dark background — black plastic */}
      <polygon points={pts(L, offset(L), D, APEX)} fill="#1a1a1a" />
      <polygon points={pts(APEX, D, offset(R), R)} fill="#1a1a1a" />

      {/* U face — solid color triangle */}
      <polygon
        points={pts(APEX, L, R)}
        fill={COLOR_HEX[topColor]}
        stroke={STROKE}
        strokeWidth={STROKE_W}
        strokeLinejoin="round"
      />

      {/* Left face stickers (0=outer near L, 2=inner near APEX/ridge) */}
      {[0, 1, 2].map((col) => (
        <polygon
          key={`l${col}`}
          points={stickerPgram(L, APEX, col)}
          fill={COLOR_HEX[stickers[col]]}
          stroke={STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
      ))}

      {/* Right face stickers (3=inner near APEX/ridge, 5=outer near R) */}
      {[0, 1, 2].map((col) => (
        <polygon
          key={`r${col}`}
          points={stickerPgram(APEX, R, col)}
          fill={COLOR_HEX[stickers[3 + col]]}
          stroke={STROKE}
          strokeWidth={STROKE_W}
          strokeLinejoin="round"
        />
      ))}
    </svg>
  );
}
