// src/hooks/use-scramble-tracking.ts
import { useState, useEffect, useCallback, useRef } from "react";
import { ScrambleTracker, type ScrambleTrackerState } from "@/core/scramble-tracker";

/** GAN cubes replay buffered moves on connect; ignore moves for this window. */
const GAN_BUFFER_FLUSH_MS = 500;

export function useScrambleTracking(
  _connection: unknown,
  scramble: string | null,
): { trackerState: ScrambleTrackerState | null; feedMove: (move: string) => void } {
  const trackerRef = useRef<ScrambleTracker | null>(null);
  const readyAtRef = useRef(0);
  const [trackerState, setTrackerState] = useState<ScrambleTrackerState | null>(null);

  // Create / destroy tracker when scramble changes
  useEffect(() => {
    if (scramble === null) {
      trackerRef.current = null;
      setTrackerState(null);
      return;
    }

    const tracker = new ScrambleTracker(scramble);
    trackerRef.current = tracker;
    readyAtRef.current = Date.now() + GAN_BUFFER_FLUSH_MS;
    setTrackerState(tracker.state);
    tracker.addStateListener(setTrackerState);

    return () => {
      trackerRef.current = null;
      setTrackerState(null);
    };
  }, [scramble]);

  const feedMove = useCallback((move: string) => {
    if (Date.now() < readyAtRef.current) return;
    trackerRef.current?.onMove(move);
  }, []);

  return { trackerState, feedMove };
}
