// src/features/f2l-trainer/F2LCaseViewer.tsx
import { useRef, useEffect } from "react";
import { TwistyPlayer } from "cubing/twisty";
import { Alg } from "cubing/alg";
import { cube3x3x3 } from "cubing/puzzles";
import { F2L_CASES } from "@/core/f2l-cases";

interface F2LCaseViewerProps {
  caseName: string; // e.g. "F2L #1"
  moves?: string[]; // user moves to apply on top of setup
}

const reg = "regular" as const;
const ign = "ignored" as const;
const dim = "dim" as const;

/**
 * z2 in experimentalSetupAlg is applied by TwistyPlayer as a visual rotation
 * — it flips the 3D model 180° around the F-B axis so white appears on the
 * visual bottom. It does NOT permute the internal piece state. The piece
 * state is computed from the non-rotation moves only (the inverse alg).
 */
const ROTATION = "z2";

/**
 * Cubing.js 3x3x3 piece identities (piece N starts at position N in solved):
 *  - Corner 0 = UFR (white/green/red)
 *  - Corner 4 = DFR (yellow/green/red)
 *  - Edge 0–3 = UF, UR, UB, UL (white cross edges)
 *  - Edge 8 = FR (green/red)
 *
 * With z2 visual rotation, white lands on D visually. So the F2L pair (white
 * cross color + F + R) corresponds to cubing.js piece 0 (corner) and piece 8
 * (edge). The 4 white cross edges are pieces 0–3.
 */
const PAIR_CORNER_PIECE = 0;
const PAIR_EDGE_PIECE = 8;
const CROSS_EDGE_PIECES = [0, 1, 2, 3];

/**
 * Compute a dynamic stickering mask for a specific F2L case.
 *
 * Strategy: find where each target piece currently lives in the piece state
 * (computed from the inverse alg only, since z2 is visual-only in
 * TwistyPlayer). Highlight those positions in the mask. The mask operates on
 * cubing.js's internal position indices; the z2 visual rotation in the
 * setup alg handles the display flip automatically.
 */
async function computeF2LMask(inverseAlg: string) {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();

  // Piece state AFTER the inverse alg (no z2 — z2 is visual-only in the player)
  const state = solved.applyAlg(inverseAlg);
  const cornerPieces = state.patternData["CORNERS"].pieces;
  const edgePieces = state.patternData["EDGES"].pieces;

  // Find current positions of the pair pieces and each cross edge
  const findCorner = (piece: number) => {
    for (let i = 0; i < 8; i++) if (cornerPieces[i] === piece) return i;
    return -1;
  };
  const findEdge = (piece: number) => {
    for (let i = 0; i < 12; i++) if (edgePieces[i] === piece) return i;
    return -1;
  };

  const pairCornerPos = findCorner(PAIR_CORNER_PIECE);
  const pairEdgePos = findEdge(PAIR_EDGE_PIECE);
  const crossEdgePositions = new Set(CROSS_EDGE_PIECES.map(findEdge));

  const regularEdges = new Set([...crossEdgePositions, pairEdgePos]);
  const regularCorners = new Set([pairCornerPos]);

  return {
    orbits: {
      EDGES: {
        pieces: Array.from({ length: 12 }, (_, i) => ({
          facelets: regularEdges.has(i) ? [reg, reg] : [ign, ign],
        })),
      },
      CORNERS: {
        pieces: Array.from({ length: 8 }, (_, i) => ({
          facelets: regularCorners.has(i) ? [reg, reg, reg] : [ign, ign, ign],
        })),
      },
      CENTERS: {
        pieces: Array.from({ length: 6 }, () => ({
          facelets: [dim, dim, dim, dim],
        })),
      },
    },
  };
}

export function F2LCaseViewer({ caseName, moves = [] }: F2LCaseViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);
  const fedCountRef = useRef(0);

  // Create player when case changes (async to compute dynamic mask)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const caseDefinition = F2L_CASES.find((c) => c.name === caseName);
    if (!caseDefinition) return;

    let cancelled = false;

    const inverseAlg = new Alg(caseDefinition.algorithm).invert().toString();
    // z2 is applied by TwistyPlayer as a visual flip; inverseAlg sets up the case.
    const setupAlg = `${ROTATION} ${inverseAlg}`;

    (async () => {
      const mask = await computeF2LMask(inverseAlg);
      if (cancelled) return;

      const player = new TwistyPlayer({
        puzzle: "3x3x3",
        visualization: "3D",
        controlPanel: "none",
        experimentalSetupAlg: setupAlg,
        experimentalStickeringMaskOrbits: mask,
      });

      // Camera angle: front-right view showing FR slot
      player.cameraLongitude = -30;
      player.cameraLatitude = 31;
      player.experimentalDragInput = "none";

      playerRef.current = player;
      fedCountRef.current = 0;
      container.appendChild(player);
    })();

    return () => {
      cancelled = true;
      const player = playerRef.current;
      playerRef.current = null;
      if (player?.parentNode) {
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
