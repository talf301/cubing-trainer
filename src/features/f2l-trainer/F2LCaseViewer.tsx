// src/features/f2l-trainer/F2LCaseViewer.tsx
import { useRef, useEffect } from "react";
import { TwistyPlayer } from "cubing/twisty";
import { Alg } from "cubing/alg";
import { F2L_CASES } from "@/core/f2l-cases";

interface F2LCaseViewerProps {
  caseName: string; // e.g. "F2L #1"
  moves?: string[]; // user moves to apply on top of setup
}

/**
 * Stickering mask for F2L case display.
 *
 * Highlights the FR slot pair (corner + edge), 4 cross edges, and all centers.
 * Everything else is gray ("ignored").
 *
 * Piece indices (cubing.js 3x3x3):
 *   EDGES: 4=DF, 5=DR, 6=DB, 7=DL (cross edges), 8=FR (target edge)
 *   CORNERS: 4=DFR (target corner)
 */
const reg = "regular" as const;
const ign = "ignored" as const;

const HIGHLIGHTED_EDGES = new Set([4, 5, 6, 7, 8]);
const DFR_CORNER = 4;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F2L_STICKERING_MASK: any = {
  orbits: {
    EDGES: {
      pieces: Array.from({ length: 12 }, (_, i) => ({
        facelets: HIGHLIGHTED_EDGES.has(i) ? [reg, reg] : [ign, ign],
      })),
    },
    CORNERS: {
      pieces: Array.from({ length: 8 }, (_, i) => ({
        facelets: i === DFR_CORNER ? [reg, reg, reg] : [ign, ign, ign],
      })),
    },
    CENTERS: {
      pieces: Array.from({ length: 6 }, () => ({
        facelets: [reg, reg, reg, reg],
      })),
    },
  },
};

export function F2LCaseViewer({ caseName, moves = [] }: F2LCaseViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);
  const fedCountRef = useRef(0);

  // Create player when case changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const caseDefinition = F2L_CASES.find((c) => c.name === caseName);
    if (!caseDefinition) return;

    // The algorithm solves the case (case -> solved).
    // Inverting it gives us the case state (solved -> case).
    // No cube rotation: default orientation has green F, red R — the standard
    // F2L pair colors. The cross face is D (yellow in cubing.js default).
    const setupAlg = new Alg(caseDefinition.algorithm).invert().toString();

    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "3D",
      controlPanel: "none",
      experimentalSetupAlg: setupAlg,
      experimentalStickeringMaskOrbits: F2L_STICKERING_MASK,
    });

    // Fix camera angle to show FR slot clearly (front-right view)
    player.cameraLongitude = -30;
    player.cameraLatitude = 31;
    // Disable drag rotation so the view stays fixed
    player.experimentalDragInput = "none";

    playerRef.current = player;
    fedCountRef.current = 0;
    container.appendChild(player);

    return () => {
      playerRef.current = null;
      if (player.parentNode) {
        player.parentNode.removeChild(player);
      }
    };
  }, [caseName]);

  // Feed new moves incrementally for responsive visualization
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const newMoves = moves.slice(fedCountRef.current);
    for (const move of newMoves) {
      player.experimentalAddMove(move);
    }
    if (newMoves.length > 0) {
      player.jumpToEnd();
    }
    fedCountRef.current = moves.length;
  }, [moves]);

  return <div ref={containerRef} className="inline-block" />;
}
