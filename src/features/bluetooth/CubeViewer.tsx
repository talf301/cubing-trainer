// src/features/bluetooth/CubeViewer.tsx
import { useRef, useEffect } from "react";
import { TwistyPlayer } from "cubing/twisty";
import type { CubeMoveEvent } from "@/core/cube-connection";

interface CubeViewerProps {
  moves: CubeMoveEvent[];
  instanceKey: number;
}

export function CubeViewer({ moves, instanceKey }: CubeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<TwistyPlayer | null>(null);
  const fedCountRef = useRef(0);

  // Create/recreate player when instanceKey changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const player = new TwistyPlayer({
      puzzle: "3x3x3",
      visualization: "2D",
      controlPanel: "none",
      backView: "none",
    });

    playerRef.current = player;
    fedCountRef.current = 0;
    container.appendChild(player);

    return () => {
      playerRef.current = null;
      if (player.parentNode) {
        player.parentNode.removeChild(player);
      }
    };
  }, [instanceKey]);

  // Feed new moves to the player
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;

    const newMoves = moves.slice(fedCountRef.current);
    for (const moveEvent of newMoves) {
      player.experimentalAddMove(moveEvent.move);
    }
    if (newMoves.length > 0) {
      player.jumpToEnd();
    }
    fedCountRef.current = moves.length;
  }, [moves]);

  return <div ref={containerRef} className="inline-block" />;
}
