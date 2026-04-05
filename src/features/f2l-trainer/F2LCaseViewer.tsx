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
 * The setup alg includes x2 to orient white cross on D. Because the mask
 * operates on piece identity (solved-state index), indices must reflect the
 * pieces that occupy the target positions AFTER x2:
 *
 *   After x2, D-layer edge positions contain solved pieces 0,1,2,3 (cross).
 *   After x2, DFR corner position contains solved piece 1.
 *   After x2, FR edge position contains solved piece 10.
 */
const reg = "regular" as const;
const ign = "ignored" as const;

// Piece indices that land at cross/FR positions after x2
const CROSS_EDGE_PIECES = new Set([0, 1, 2, 3]);
const FR_EDGE_PIECE = 10;
const DFR_CORNER_PIECE = 1;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const F2L_STICKERING_MASK: any = {
  orbits: {
    EDGES: {
      pieces: Array.from({ length: 12 }, (_, i) => ({
        facelets: CROSS_EDGE_PIECES.has(i) || i === FR_EDGE_PIECE
          ? [reg, reg]
          : [ign, ign],
      })),
    },
    CORNERS: {
      pieces: Array.from({ length: 8 }, (_, i) => ({
        facelets: i === DFR_CORNER_PIECE
          ? [reg, reg, reg]
          : [ign, ign, ign],
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
    // Prepend x2 so white cross is on bottom (yellow up).
    const inverseAlg = new Alg(caseDefinition.algorithm).invert().toString();
    const setupAlg = `x2 ${inverseAlg}`;

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
