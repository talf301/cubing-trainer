// src/features/ll-trainer/use-ll-practice.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { CubeConnection, CubeMoveEvent } from "@/core/cube-connection";
import {
  LLPracticeSession,
  type LLPracticePhase,
  type LLPracticeCompletion,
} from "@/core/ll-practice-session";
import type { ScrambleTrackerState } from "@/core/scramble-tracker";
import { generateLLScramble, warmupSolver } from "@/core/ll-scramble";
import {
  LLPracticeStore,
  type LLPracticeAttempt,
} from "@/lib/ll-practice-store";

const llStore = new LLPracticeStore();

/** Maximum number of recent completions to keep in the ephemeral list */
const MAX_RECENT = 25;

export interface LLPracticeState {
  phase: LLPracticePhase;
  scramble: string;
  trackerState: ScrambleTrackerState | null;
  displayMs: number;
  lastCompletion: LLPracticeCompletion | null;
  recentCompletions: LLPracticeCompletion[];
}

export function useLLPractice(connection: CubeConnection): LLPracticeState {
  const sessionRef = useRef(new LLPracticeSession());
  const [phase, setPhase] = useState<LLPracticePhase>("idle");
  const [scramble, setScramble] = useState("");
  const [trackerState, setTrackerState] = useState<ScrambleTrackerState | null>(
    null,
  );
  const [displayMs, setDisplayMs] = useState(0);
  const [lastCompletion, setLastCompletion] =
    useState<LLPracticeCompletion | null>(null);
  const [recentCompletions, setRecentCompletions] = useState<
    LLPracticeCompletion[]
  >([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solveStartWallRef = useRef(0);
  const lastTotalRef = useRef(0);
  // GAN cubes replay buffered moves on connect; ignore moves arriving
  // within this window after the session starts.
  const trackerReadyAtRef = useRef(0);

  // Warm up solver on mount
  useEffect(() => {
    warmupSolver();
  }, []);

  const startNextScramble = useCallback(async () => {
    const result = await generateLLScramble();
    setScramble(result.scramble);

    // Show previous total time during scrambling
    setDisplayMs(lastTotalRef.current);

    sessionRef.current.start(result.scramble, result.expectedState);
    trackerReadyAtRef.current = Date.now() + 500;
  }, []);

  // Auto-generate scramble on connect
  useEffect(() => {
    const onStatus = (status: string) => {
      if (
        status === "connected" &&
        sessionRef.current.currentPhase === "idle"
      ) {
        startNextScramble();
      }
    };

    if (
      connection.status === "connected" &&
      sessionRef.current.currentPhase === "idle"
    ) {
      startNextScramble();
    }

    connection.addStatusListener(onStatus);
    return () => connection.removeStatusListener(onStatus);
  }, [connection, startNextScramble]);

  // Reset session on disconnect
  useEffect(() => {
    const onStatus = (status: string) => {
      if (status === "disconnected") {
        sessionRef.current.reset();
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };
    connection.addStatusListener(onStatus);
    return () => connection.removeStatusListener(onStatus);
  }, [connection]);

  // Listen to phase changes
  useEffect(() => {
    const session = sessionRef.current;

    const onPhase = (newPhase: LLPracticePhase) => {
      setPhase(newPhase);

      // Update tracker state from session
      setTrackerState(session.scrambleTrackerState);

      if (newPhase === "solving_oll") {
        // OLL phase starts — begin wall-clock timer
        solveStartWallRef.current = Date.now();
        timerRef.current = setInterval(() => {
          setDisplayMs(Date.now() - solveStartWallRef.current);
        }, 10);
      }

      if (newPhase === "solving_pll") {
        // Clear tracker state when done scrambling
        setTrackerState(null);
      }

      if (newPhase === "done") {
        // Stop the timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    };

    session.addPhaseListener(onPhase);
    return () => {
      session.removePhaseListener(onPhase);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Listen to completion events
  useEffect(() => {
    const session = sessionRef.current;

    const onCompletion = (completion: LLPracticeCompletion) => {
      // Freeze timer at actual total
      setDisplayMs(completion.totalTime);
      lastTotalRef.current = completion.totalTime;
      setLastCompletion(completion);
      setRecentCompletions((prev) =>
        [completion, ...prev].slice(0, MAX_RECENT),
      );

      // Persist to IndexedDB
      const attempt: LLPracticeAttempt = {
        id: crypto.randomUUID(),
        ollSegments: completion.ollSegments,
        pllSegments: completion.pllSegments,
        ollTime: completion.ollTime,
        pllTime: completion.pllTime,
        totalTime: completion.totalTime,
        timestamp: completion.timestamp,
      };
      llStore.addAttempt(attempt);

      // Auto-advance to next scramble
      startNextScramble();
    };

    session.addCompletionListener(onCompletion);
    return () => session.removeCompletionListener(onCompletion);
  }, [startNextScramble]);

  // Feed cube moves to the session
  useEffect(() => {
    const session = sessionRef.current;

    const onMove = (event: CubeMoveEvent) => {
      const moveStr = event.move.toString();

      // Skip moves arriving during the post-connect buffer flush window
      if (
        session.currentPhase === "scrambling" &&
        Date.now() < trackerReadyAtRef.current
      ) {
        return;
      }

      session.onMove(moveStr, event.timestamp, event.state);

      // Keep tracker state in sync during scrambling
      if (session.currentPhase === "scrambling") {
        setTrackerState(session.scrambleTrackerState);
      }
    };

    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection]);

  return {
    phase,
    scramble,
    trackerState,
    displayMs,
    lastCompletion,
    recentCompletions,
  };
}
