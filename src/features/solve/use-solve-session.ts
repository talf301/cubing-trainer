// src/features/solve/use-solve-session.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { CubeConnection, CubeMoveEvent } from "@/core/cube-connection";
import { SolveSession, type SolvePhase } from "@/core/solve-session";
import { generateScramble } from "@/lib/scramble";
import { SolveStore, type StoredSolve } from "@/lib/solve-store";
import { segmentSolve } from "@/core/cfop-segmenter";
import { useScrambleTracking } from "@/hooks/use-scramble-tracking";

const solveStore = new SolveStore();

export function useSolveSession(connection: CubeConnection) {
  const sessionRef = useRef(new SolveSession());
  const [phase, setPhase] = useState<SolvePhase>("idle");
  const [scramble, setScramble] = useState<string>("");
  const [displayMs, setDisplayMs] = useState(0);
  const [recentSolves, setRecentSolves] = useState<StoredSolve[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solveStartWallRef = useRef(0);
  const lastSolveDurationRef = useRef(0);

  const { trackerState, feedMove } = useScrambleTracking(
    connection,
    phase === "scrambling" ? scramble : null,
  );

  // Load recent solves on mount
  useEffect(() => {
    solveStore.backfillSplits().then(() => {
      solveStore.getAll().then(setRecentSolves);
    });
  }, []);

  const startNewSolve = useCallback(async () => {
    const result = await generateScramble();
    setScramble(result.scramble);

    // Show previous solve time during scrambling
    setDisplayMs(lastSolveDurationRef.current);

    sessionRef.current.startScramble(result.scramble, result.expectedState);
  }, []);

  // Auto-generate scramble on connect
  useEffect(() => {
    const onStatus = (status: string) => {
      if (status === "connected" && sessionRef.current.phase === "idle") {
        startNewSolve();
      }
    };

    // Check if already connected
    if (connection.status === "connected" && sessionRef.current.phase === "idle") {
      startNewSolve();
    }

    connection.addStatusListener(onStatus);
    return () => connection.removeStatusListener(onStatus);
  }, [connection, startNewSolve]);

  // Listen to phase changes
  useEffect(() => {
    const session = sessionRef.current;
    const onPhase = (newPhase: SolvePhase) => {
      setPhase(newPhase);

      if (newPhase === "ready") {
        // Show 0 while waiting to solve
        setDisplayMs(0);
      }

      if (newPhase === "solving") {
        solveStartWallRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setDisplayMs(Date.now() - solveStartWallRef.current);
        }, 10);
      }

      if (newPhase === "solved") {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setDisplayMs(session.duration);
        lastSolveDurationRef.current = session.duration;

        // Save the completed solve
        const solve: StoredSolve = {
          id: crypto.randomUUID(),
          scramble: session.scramble,
          moves: [...session.moves],
          startTime: session.startTime,
          endTime: session.endTime,
          duration: session.duration,
          createdAt: Date.now(),
        };
        // Run segmentation before saving
        segmentSolve(solve.scramble, solve.moves).then((splits) => {
          solve.splits = splits;
          solveStore.save(solve).then(() => {
            solveStore.getAll().then(setRecentSolves);
          });
        });

        // Auto-advance to next scramble
        startNewSolve();
      }
    };

    session.addPhaseListener(onPhase);
    return () => {
      session.removePhaseListener(onPhase);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startNewSolve]);

  // Listen to cube moves and feed them to session + tracker
  useEffect(() => {
    const session = sessionRef.current;

    const onMove = (event: CubeMoveEvent) => {
      const moveStr = event.move.toString();

      if (session.phase === "scrambling") {
        feedMove(moveStr);
        // Check if scramble state matches
        session.onCubeState(event.state);
      } else if (session.phase === "ready" || session.phase === "solving") {
        session.onMove(moveStr, event.timestamp, event.state);
      }
    };

    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection, feedMove]);

  return {
    phase,
    scramble,
    displayMs,
    trackerState,
    recentSolves,
  };
}
