// src/features/f2l-trainer/F2LCaseViewer.tsx
import { useRef, useEffect } from "react";
import { TwistyPlayer } from "cubing/twisty";
import type { StickeringMask } from "cubing/twisty";
import { Alg } from "cubing/alg";
import { F2L_CASES } from "@/core/f2l-cases";

interface F2LCaseViewerProps {
  caseName: string; // e.g. "F2L #1"
}

/**
 * Stickering mask for F2L case display.
 *
 * Highlights the FR slot pair (corner + edge), 4 cross edges, and all centers.
 * Everything else is dimmed.
 *
 * Piece indices (3x3x3 cubing.js convention):
 *   EDGES (12 pieces, 2 facelets each):
 *     4=DF, 5=DR, 6=DB, 7=DL (cross edges), 8=FR (target edge)
 *   CORNERS (8 pieces, 3 facelets each):
 *     4=DFR (target corner)
 *   CENTERS (6 pieces, 4 facelets each):
 *     All regular (provide orientation context)
 */
const F2L_STICKERING_MASK: StickeringMask = {
  orbits: {
    EDGES: {
      pieces: Array.from({ length: 12 }, (_, i) => ({
        facelets: [4, 5, 6, 7, 8].includes(i)
          ? ["regular", "regular"] as const
          : ["dim", "dim"] as const,
      })),
    },
    CORNERS: {
      pieces: Array.from({ length: 8 }, (_, i) => ({
        facelets: i === 4
          ? ["regular", "regular", "regular"] as const
          : ["dim", "dim", "dim"] as const,
      })),
    },
    CENTERS: {
      pieces: Array.from({ length: 6 }, () => ({
        facelets: ["regular", "regular", "regular", "regular"] as const,
      })),
    },
  },
};

export function F2LCaseViewer({ caseName }: F2LCaseViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const caseDefinition = F2L_CASES.find((c) => c.name === caseName);
    if (!caseDefinition) return;

    // The algorithm solves the case (case -> solved).
    // Inverting it gives us the case state (solved -> case).
    const setupAlg = new Alg(caseDefinition.algorithm).invert().toString();

    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "3D",
      controlPanel: "none",
      experimentalSetupAlg: setupAlg,
      experimentalStickeringMaskOrbits: F2L_STICKERING_MASK,
    });

    container.appendChild(player);

    return () => {
      if (player.parentNode) {
        player.parentNode.removeChild(player);
      }
    };
  }, [caseName]);

  return <div ref={containerRef} className="inline-block" />;
}
