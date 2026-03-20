// src/features/solve/use-solve-session.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { CubeConnection, CubeMoveEvent } from "@/core/cube-connection";
import { SolveSession, type SolvePhase } from "@/core/solve-session";
import { generateScramble } from "@/lib/scramble";
import { SolveStore, type StoredSolve } from "@/lib/solve-store";

const solveStore = new SolveStore();

export function useSolveSession(connection: CubeConnection) {
  const sessionRef = useRef(new SolveSession());
  const [phase, setPhase] = useState<SolvePhase>("idle");
  const [scramble, setScramble] = useState<string>("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [recentSolves, setRecentSolves] = useState<StoredSolve[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solveStartWallRef = useRef(0);

  // Load recent solves on mount
  useEffect(() => {
    solveStore.getAll().then(setRecentSolves);
  }, []);

  // Listen to phase changes
  useEffect(() => {
    const session = sessionRef.current;
    const onPhase = (newPhase: SolvePhase) => {
      setPhase(newPhase);

      if (newPhase === "solving") {
        solveStartWallRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setElapsedMs(Date.now() - solveStartWallRef.current);
        }, 10);
      }

      if (newPhase === "solved") {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setElapsedMs(session.duration);

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
        solveStore.save(solve).then(() => {
          solveStore.getAll().then(setRecentSolves);
        });
      }
    };

    session.addPhaseListener(onPhase);
    return () => {
      session.removePhaseListener(onPhase);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Listen to cube moves and feed them to the session
  useEffect(() => {
    const session = sessionRef.current;

    const onMove = (event: CubeMoveEvent) => {
      if (session.phase === "scrambling") {
        // Check if this move completes the scramble — but don't also start solving.
        // The NEXT move after scramble is verified starts the timer.
        session.onCubeState(event.state);
      } else if (session.phase === "ready" || session.phase === "solving") {
        session.onMove(event.move.toString(), event.timestamp, event.state);
      }
    };

    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection]);

  const startNewSolve = useCallback(async () => {
    const result = await generateScramble();
    setScramble(result.scramble);
    setElapsedMs(0);
    sessionRef.current.startScramble(result.scramble, result.expectedState);
  }, []);

  return {
    phase,
    scramble,
    elapsedMs,
    recentSolves,
    startNewSolve,
  };
}
