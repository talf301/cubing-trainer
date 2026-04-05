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
 * We keep the cube in its native cubing.js orientation (U=white, D=yellow,
 * F=green, R=red) so bluetooth moves from the physical cube apply 1:1 to
 * the virtual state — no rotation-induced piece permutation. The trainer
 * therefore practices F2L with a YELLOW cross on D (pieces 4-7) and the
 * FR pair as the yellow/green/red corner + green/red edge. The camera is
 * tilted below the equator so the D face (yellow) and FR slot face the
 * user.
 *
 * cubing.js's stickering mask is indexed by PIECE IDENTITY (piece N = the
 * piece that starts at position N in the solved state). The mask follows
 * each piece wherever it moves, so the highlighted pieces are the same for
 * every F2L case.
 *
 *   - Cross edges = pieces 4, 5, 6, 7 (DF, DR, DB, DL — yellow edges)
 *   - Pair corner = piece 4 (DFR = yellow/green/red)
 *   - Pair edge = piece 8 (FR = green/red)
 */
const PAIR_CORNER_PIECE = 4;
const PAIR_EDGE_PIECE = 8;
const CROSS_EDGE_PIECES = [4, 5, 6, 7];

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

    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "3D",
      controlPanel: "none",
      experimentalSetupAlg: inverseAlg,
      experimentalStickeringMaskOrbits: F2L_MASK,
    });

    // Below-equator view: look up at the D (yellow) face so the FR slot
    // (where the pair inserts) is pointed at the camera.
    player.cameraLatitudeLimit = 90;
    player.cameraLongitude = -30;
    player.cameraLatitude = -31;
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
