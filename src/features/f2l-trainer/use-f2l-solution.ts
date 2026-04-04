// src/features/f2l-trainer/use-f2l-solution.ts
import { useState, useEffect, useRef, useCallback } from "react";
import type { KPattern } from "cubing/kpuzzle";
import type { CubeConnection, CubeMoveEvent } from "@/core/cube-connection";
import {
  F2LSolutionSession,
  selectF2LCase,
  type F2LSessionPhase,
  type F2LAttemptResult,
  type F2LCaseStats,
} from "@/core/f2l-solution-session";
import { F2LSolutionStore } from "@/lib/f2l-solution-store";

const store = new F2LSolutionStore();

export interface F2LSolutionState {
  phase: F2LSessionPhase;
  caseName: string | null;
  casePattern: KPattern | null;
  timerMs: number;
  result: F2LAttemptResult | null;
  skip: () => void;
  next: () => void;
}

/**
 * Compute per-case stats from raw attempts for weighted case selection.
 */
function buildCaseStats(
  attempts: { caseName: string; time: number }[],
): F2LCaseStats[] {
  const byCase = new Map<string, number[]>();
  for (const a of attempts) {
    let times = byCase.get(a.caseName);
    if (!times) {
      times = [];
      byCase.set(a.caseName, times);
    }
    times.push(a.time);
  }

  const stats: F2LCaseStats[] = [];
  for (const [caseName, times] of byCase) {
    times.sort((a, b) => a - b);
    const top5Count = Math.max(1, Math.ceil(times.length * 0.05));
    const top5Avg =
      times.slice(0, top5Count).reduce((s, t) => s + t, 0) / top5Count;
    stats.push({ caseName, attemptCount: times.length, top5AvgTime: top5Avg });
  }
  return stats;
}

export function useF2LSolution(connection: CubeConnection): F2LSolutionState {
  const sessionRef = useRef<F2LSolutionSession>(new F2LSolutionSession(store));
  const caseStatsRef = useRef<F2LCaseStats[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const solveStartRef = useRef(0);

  const [phase, setPhase] = useState<F2LSessionPhase>("idle");
  const [caseName, setCaseName] = useState<string | null>(null);
  const [casePattern, setCasePattern] = useState<KPattern | null>(null);
  const [timerMs, setTimerMs] = useState(0);
  const [result, setResult] = useState<F2LAttemptResult | null>(null);

  // Timer management
  const startTimer = useCallback((timestamp: number) => {
    solveStartRef.current = timestamp;
    timerRef.current = setInterval(() => {
      setTimerMs(Date.now() - solveStartRef.current);
    }, 10);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Present the next case based on weakness-weighted selection
  const presentNext = useCallback(async () => {
    const nextCase = selectF2LCase(caseStatsRef.current);
    const session = sessionRef.current;
    await session.presentCase(nextCase);
    setCaseName(session.currentCase?.name ?? null);
    setCasePattern(session.caseState);
    setTimerMs(0);
    setResult(null);
  }, []);

  // Load attempt history on mount for weakness-based case selection
  useEffect(() => {
    store.getAllAttempts().then((attempts) => {
      caseStatsRef.current = buildCaseStats(attempts);
    });
  }, []);

  // Listen to phase changes
  useEffect(() => {
    const session = sessionRef.current;
    const onPhase = (p: F2LSessionPhase) => {
      setPhase(p);
      if (p === "solving") {
        startTimer(Date.now());
      } else {
        stopTimer();
      }
      if (p === "idle") {
        // Auto-present next case
        presentNext();
      }
    };
    session.addPhaseListener(onPhase);
    return () => session.removePhaseListener(onPhase);
  }, [startTimer, stopTimer, presentNext]);

  // Listen to result events and update stats
  useEffect(() => {
    const session = sessionRef.current;
    const onResult = (r: F2LAttemptResult) => {
      setResult(r);
      setTimerMs(r.time);
      // Update stats for future case selection
      store.getAllAttempts().then((attempts) => {
        caseStatsRef.current = buildCaseStats(attempts);
      });
    };
    session.addResultListener(onResult);
    return () => session.removeResultListener(onResult);
  }, []);

  // Feed cube moves to the session
  useEffect(() => {
    const session = sessionRef.current;
    const onMove = (event: CubeMoveEvent) => {
      session.onMove(event.move.toString(), event.timestamp);
    };
    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection]);

  // Reset session on disconnect
  useEffect(() => {
    const onStatus = (status: string) => {
      if (status === "disconnected") {
        sessionRef.current.reset();
        stopTimer();
        setPhase("idle");
        setCaseName(null);
        setCasePattern(null);
        setTimerMs(0);
        setResult(null);
      }
    };
    connection.addStatusListener(onStatus);
    return () => connection.removeStatusListener(onStatus);
  }, [connection, stopTimer]);

  const skip = useCallback(() => {
    sessionRef.current.skip();
  }, []);

  const next = useCallback(() => {
    sessionRef.current.next();
  }, []);

  return { phase, caseName, casePattern, timerMs, result, skip, next };
}
