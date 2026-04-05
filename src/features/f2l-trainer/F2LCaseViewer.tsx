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
 * z2 orients the cube with white on D, green on F, orange on R — matching
 * SpeedCubeDB's F2L display. The DFR pair becomes white/green/orange.
 */
const ROTATION = "z2";

/**
 * Compute a dynamic stickering mask for a specific F2L case.
 *
 * The mask is position-based in cubing.js. We determine which pieces
 * belong at DFR and FR in the *rotated* solved state, then find where
 * those pieces actually are in the setup state. This ensures the
 * highlighted corner/edge always match the pair the user needs to solve.
 */
async function computeF2LMask(setupAlg: string) {
  const kpuzzle = await cube3x3x3.kpuzzle();
  const solved = kpuzzle.defaultPattern();

  // Determine which pieces should be at DFR(4) and FR(8) in the rotated frame
  const rotatedSolved = solved.applyAlg(ROTATION);
  const targetCorner = rotatedSolved.patternData["CORNERS"].pieces[4];
  const targetEdge = rotatedSolved.patternData["EDGES"].pieces[8];

  // Find where those pieces are in the full setup state (rotation + inverse alg)
  const setupState = solved.applyAlg(setupAlg);
  const cornerPieces = setupState.patternData["CORNERS"].pieces;
  const edgePieces = setupState.patternData["EDGES"].pieces;

  let frCornerPos = -1;
  for (let i = 0; i < 8; i++) {
    if (cornerPieces[i] === targetCorner) { frCornerPos = i; break; }
  }
  let frEdgePos = -1;
  for (let i = 0; i < 12; i++) {
    if (edgePieces[i] === targetEdge) { frEdgePos = i; break; }
  }

  // Cross edges (D-layer positions 4–7) + the displaced FR edge
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

    // z2 puts white on D, green on F. Then the inverse alg sets up the case.
    const inverseAlg = new Alg(caseDefinition.algorithm).invert().toString();
    const setupAlg = `${ROTATION} ${inverseAlg}`;

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
