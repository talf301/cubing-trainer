// src/features/f2l-trainer/F2LCaseViewer.tsx
import { useRef, useEffect } from "react";
import { TwistyPlayer } from "cubing/twisty";
import { Alg } from "cubing/alg";
import { F2L_CASES } from "@/core/f2l-cases";

interface F2LCaseViewerProps {
  caseName: string; // e.g. "F2L #1"
  moves?: string[]; // user moves to apply on top of setup
}

const reg = "regular" as const;
const ign = "ignored" as const;
const dim = "dim" as const;

/**
 * z2 in experimentalSetupAlg is both a piece permutation AND a visual flip.
 * It swaps U↔D and R↔L so white lands on D and orange lands on R visually.
 */
const ROTATION = "z2";

/**
 * cubing.js's stickering mask is indexed by PIECE IDENTITY (piece N = piece
 * that starts at position N in the solved state). The mask follows each
 * piece wherever it moves, so the highlighted pieces are the same for every
 * F2L case.
 *
 * For white cross on D (after z2 swaps U↔D, R↔L):
 *   - Cross edges = pieces 0, 1, 2, 3 (UF, UR, UB, UL = white cross edges)
 *   - Pair corner = piece 3 (UFL = white/green/orange, lands in the DFR
 *     slot visually since z2 maps UFL → DFR)
 *   - Pair edge = piece 9 (FL = green/orange, lands in FR slot visually)
 */
const PAIR_CORNER_PIECE = 3;
const PAIR_EDGE_PIECE = 9;
const CROSS_EDGE_PIECES = [0, 1, 2, 3];

const regularEdgePieces = new Set([...CROSS_EDGE_PIECES, PAIR_EDGE_PIECE]);
const regularCornerPieces = new Set([PAIR_CORNER_PIECE]);

const F2L_MASK = {
  orbits: {
    EDGES: {
      pieces: Array.from({ length: 12 }, (_, i) => ({
        facelets: regularEdgePieces.has(i) ? [reg, reg] : [ign, ign],
      })),
    },
    CORNERS: {
      pieces: Array.from({ length: 8 }, (_, i) => ({
        facelets: regularCornerPieces.has(i) ? [reg, reg, reg] : [ign, ign, ign],
      })),
    },
    CENTERS: {
      pieces: Array.from({ length: 6 }, () => ({
        facelets: [dim, dim, dim, dim],
      })),
    },
  },
};

export function F2LCaseViewer({ caseName, moves = [] }: F2LCaseViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);
  const fedCountRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const caseDefinition = F2L_CASES.find((c) => c.name === caseName);
    if (!caseDefinition) return;

    const inverseAlg = new Alg(caseDefinition.algorithm).invert().toString();
    const setupAlg = `${ROTATION} ${inverseAlg}`;

    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "3D",
      controlPanel: "none",
      experimentalSetupAlg: setupAlg,
      experimentalStickeringMaskOrbits: F2L_MASK,
    });

    player.cameraLongitude = -30;
    player.cameraLatitude = 31;
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
