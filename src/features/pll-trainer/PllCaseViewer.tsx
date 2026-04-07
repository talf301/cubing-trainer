// src/features/pll-trainer/PllCaseViewer.tsx
import { useRef, useEffect } from "react";
import { TwistyPlayer } from "cubing/twisty";
import { Alg } from "cubing/alg";
import { PLL_CASES } from "@/core/pll-cases";
import type { ViewingCorner, AUF } from "@/core/pll-sticker-cache";

export type VisibleSides = 2 | 3 | 4;

interface PllCaseViewerProps {
  caseName: string;
  auf?: AUF;
  corner?: ViewingCorner;
  visibleSides?: VisibleSides;
  size?: number;
}

const reg = "regular" as const;
const dim = "dim" as const;

/**
 * Side faces indexed CW from above: F=0, R=1, B=2, L=3.
 *
 * Viewing corner c sits between face c and face (c+1)%4.
 *   2 sides → {c, (c+1)%4}
 *   3 sides → {(c-1+4)%4, c, (c+1)%4}
 *   4 sides → all
 */
function getVisibleFaces(corner: ViewingCorner, sides: VisibleSides): Set<number> {
  if (sides === 4) return new Set([0, 1, 2, 3]);
  const c = corner as number;
  const faces = new Set([c, (c + 1) % 4]);
  if (sides === 3) faces.add((c + 3) % 4);
  return faces;
}

/**
 * Edge piece i (0-3) has its side sticker on face i.
 *   facelet 0 = U sticker, facelet 1 = side sticker
 *
 * Corner piece i (0-3) in cubing.js kpuzzle order (URF, UBR, ULB, UFL):
 *   facelet 0 = U sticker
 *   facelet 1 = face (i+1)%4   (R for URF, B for UBR, L for ULB, F for UFL)
 *   facelet 2 = face i          (F for URF, R for UBR, B for ULB, L for UFL)
 */
const EDGE_SIDE_FACE = [0, 1, 2, 3]; // piece i → face index
const CORNER_FACELET1_FACE = [1, 2, 3, 0]; // piece i → face of facelet 1
const CORNER_FACELET2_FACE = [0, 1, 2, 3]; // piece i → face of facelet 2

function buildMask(corner: ViewingCorner, sides: VisibleSides) {
  const visible = getVisibleFaces(corner, sides);

  return {
    orbits: {
      EDGES: {
        pieces: Array.from({ length: 12 }, (_, i) => {
          if (i >= 4) return { facelets: [dim, dim] };
          const sideVis = visible.has(EDGE_SIDE_FACE[i]) ? reg : dim;
          return { facelets: [reg, sideVis] };
        }),
      },
      CORNERS: {
        pieces: Array.from({ length: 8 }, (_, i) => {
          if (i >= 4) return { facelets: [dim, dim, dim] };
          const f1Vis = visible.has(CORNER_FACELET1_FACE[i]) ? reg : dim;
          const f2Vis = visible.has(CORNER_FACELET2_FACE[i]) ? reg : dim;
          return { facelets: [reg, f1Vis, f2Vis] };
        }),
      },
      CENTERS: {
        pieces: Array.from({ length: 6 }, () => ({
          facelets: [dim, dim, dim, dim],
        })),
      },
    },
  };
}

/**
 * Map viewing corner to camera longitude.
 * Corner 0 (UFR) -> 35deg, then +90deg per corner going CW.
 */
const CORNER_LONGITUDE: Record<ViewingCorner, number> = {
  0: 35,
  1: 125,
  2: 215,
  3: 305,
};

export function PllCaseViewer({
  caseName,
  auf = "",
  corner = 0,
  visibleSides = 2,
  size = 240,
}: PllCaseViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const caseData = PLL_CASES[caseName];
    if (!caseData) return;

    const inverseAlg = new Alg(caseData.algorithm).invert().toString();
    const setupAlg = auf ? `${inverseAlg} ${auf}` : inverseAlg;

    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "3D",
      controlPanel: "none",
      experimentalSetupAlg: setupAlg,
      experimentalStickeringMaskOrbits: buildMask(corner, visibleSides),
    });

    player.cameraLongitude = CORNER_LONGITUDE[corner];
    player.cameraLatitude = 31;
    player.experimentalDragInput = "none";

    player.style.width = `${size}px`;
    player.style.height = `${size}px`;

    playerRef.current = player;
    container.appendChild(player);

    return () => {
      playerRef.current = null;
      if (player.parentNode) {
        player.parentNode.removeChild(player);
      }
    };
  }, [caseName, auf, corner, visibleSides, size]);

  return <div ref={containerRef} className="inline-block" />;
}
