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

/**
 * Compute a stickering mask that highlights the FR pair pieces wherever
 * they actually are, plus the cross edges and centers.
 *
 * The mask is position-based in cubing.js: entry i controls the sticker
 * at orbit position i. We find which positions the DFR corner (piece 4)
 * and FR edge (piece 8) occupy in the case setup state, and highlight those.
 *
 * Cross edge positions (4–7, D-layer) are always highlighted.
 */
async function computeF2LMask(setupAlg: string) {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const caseState = kpuzzle.defaultPattern().applyAlg(setupAlg);

  const cornerPieces = caseState.patternData["CORNERS"].pieces;
  const edgePieces = caseState.patternData["EDGES"].pieces;

  // DFR corner = piece 4, FR edge = piece 8
  let frCornerPos = -1;
  for (let i = 0; i < 8; i++) {
    if (cornerPieces[i] === 4) { frCornerPos = i; break; }
  }
  let frEdgePos = -1;
  for (let i = 0; i < 12; i++) {
    if (edgePieces[i] === 8) { frEdgePos = i; break; }
  }

  // Cross edges (D-layer positions) + the displaced FR edge
  const highlightedEdges = new Set([4, 5, 6, 7, frEdgePos]);
  const highlightedCorners = new Set([frCornerPos]);

  return {
    orbits: {
      EDGES: {
        pieces: Array.from({ length: 12 }, (_, i) => ({
          facelets: highlightedEdges.has(i) ? [reg, reg] : [ign, ign],
        })),
      },
      CORNERS: {
        pieces: Array.from({ length: 8 }, (_, i) => ({
          facelets: highlightedCorners.has(i) ? [reg, reg, reg] : [ign, ign, ign],
        })),
      },
      CENTERS: {
        pieces: Array.from({ length: 6 }, () => ({
          facelets: [reg, reg, reg, reg],
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

    const setupAlg = new Alg(caseDefinition.algorithm).invert().toString();

    (async () => {
      const mask = await computeF2LMask(setupAlg);
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
