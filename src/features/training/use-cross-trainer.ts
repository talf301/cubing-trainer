// src/features/training/use-cross-trainer.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { CubeConnection, CubeMoveEvent } from "@/core/cube-connection";
import {
  CrossTrainerSession,
  type CrossTrainerPhase,
  type CrossTrainerResult,
} from "@/core/cross-trainer-session";
import {
  ScrambleTracker,
  type ScrambleTrackerState,
} from "@/core/scramble-tracker";
import { generateScramble } from "@/lib/scramble";
import { cube3x3x3 } from "cubing/puzzles";

export function useCrossTrainer(connection: CubeConnection) {
  const sessionRef = useRef(new CrossTrainerSession());
  const trackerRef = useRef<ScrambleTracker | null>(null);
  const [phase, setPhase] = useState<CrossTrainerPhase>("idle");
  const [scramble, setScramble] = useState<string>("");
  const [displayMs, setDisplayMs] = useState(0);
  const [trackerState, setTrackerState] =
    useState<ScrambleTrackerState | null>(null);
  const [result, setResult] = useState<CrossTrainerResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solveStartWallRef = useRef(0);
  const lastSolveDurationRef = useRef(0);
  // GAN cubes replay buffered moves on connect; ignore moves arriving
  // within this window after the tracker is created.
  const trackerReadyAtRef = useRef(0);

  const startNewScramble = useCallback(async () => {
    setResult(null);
    const [scrambleResult, kpuzzle] = await Promise.all([
      generateScramble(connection.state ?? undefined),
      cube3x3x3.kpuzzle(),
    ]);
    setScramble(scrambleResult.scramble);

    // Create a new ScrambleTracker for this scramble.
    const tracker = new ScrambleTracker(scrambleResult.scramble);
    trackerRef.current = tracker;
    trackerReadyAtRef.current = Date.now() + 500;
    setTrackerState(tracker.state);
    tracker.addStateListener(setTrackerState);

    // Show previous solve time during scrambling
    setDisplayMs(lastSolveDurationRef.current);

    sessionRef.current.startScramble(
      scrambleResult.scramble,
      scrambleResult.expectedState,
      kpuzzle,
    );
  }, [connection]);

  // Auto-generate scramble on connect
  useEffect(() => {
    const onStatus = (status: string) => {
      if (status === "connected" && sessionRef.current.phase === "idle") {
        startNewScramble();
      }
    };

    if (
      connection.status === "connected" &&
      sessionRef.current.phase === "idle"
    ) {
      startNewScramble();
    }

    connection.addStatusListener(onStatus);
    return () => connection.removeStatusListener(onStatus);
  }, [connection, startNewScramble]);

  // Listen to phase changes
  useEffect(() => {
    const session = sessionRef.current;
    const onPhase = (newPhase: CrossTrainerPhase) => {
      setPhase(newPhase);

      if (newPhase === "ready") {
        // Clean up tracker
        if (trackerRef.current) {
          trackerRef.current.removeStateListener(setTrackerState);
          trackerRef.current = null;
          setTrackerState(null);
        }
        // Show 0 while waiting to solve
        setDisplayMs(0);
      }

      if (newPhase === "solving") {
        solveStartWallRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setDisplayMs(Date.now() - solveStartWallRef.current);
        }, 10);
      }

      if (newPhase === "review") {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        setDisplayMs(session.duration);
        lastSolveDurationRef.current = session.duration;

        // Fetch result (includes awaiting optimal solution)
        session.getResult().then(setResult).catch((err) => {
          console.error("[cross-trainer] Failed to get result:", err);
          setResult(null);
        });
      }
    };

    session.addPhaseListener(onPhase);
    return () => {
      session.removePhaseListener(onPhase);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [startNewScramble]);

  // Listen to cube moves and feed them to session + tracker
  useEffect(() => {
    const session = sessionRef.current;

    const onMove = (event: CubeMoveEvent) => {
      const moveStr = event.move.toString();

      if (session.phase === "scrambling") {
        // Feed move to tracker for progress display.
        // Skip moves arriving during the post-connect buffer flush window.
        if (trackerRef.current && Date.now() >= trackerReadyAtRef.current) {
          trackerRef.current.onMove(moveStr);
        }
        // Check if scramble state matches
        session.onCubeState(event.state);
      } else if (session.phase === "ready" || session.phase === "solving") {
        session.onMove(moveStr, event.timestamp, event.state);
      }
    };

    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection]);

  const nextScramble = useCallback(() => {
    sessionRef.current.reset();
    startNewScramble();
  }, [startNewScramble]);

  return {
    phase,
    scramble,
    displayMs,
    trackerState,
    result,
    nextScramble,
  };
}
