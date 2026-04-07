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
  caseKey: number;
  moves: string[];
  timerMs: number;
  result: F2LAttemptResult | null;
  hintAlgorithm: string | null;
  skip: () => void;
  next: () => void;
  retry: () => void;
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
  const [caseKey, setCaseKey] = useState(0);
  const [moves, setMoves] = useState<string[]>([]);
  const [timerMs, setTimerMs] = useState(0);
  const [result, setResult] = useState<F2LAttemptResult | null>(null);
  const [hintAlgorithm, setHintAlgorithm] = useState<string | null>(null);

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
    const session = sessionRef.current;
    if (session.phase !== "idle") return;
    const nextCase = selectF2LCase(caseStatsRef.current);
    await session.presentCase(nextCase);
    setCaseName(session.currentCase?.name ?? null);
    setCasePattern(session.caseState);
    setCaseKey((k) => k + 1);
    setMoves([]);
    setTimerMs(0);
    setResult(null);
    setHintAlgorithm(null);
  }, []);

  // Load attempt history on mount, then present first case
  useEffect(() => {
    let cancelled = false;
    store.getAllAttempts().then((attempts) => {
      if (cancelled) return;
      caseStatsRef.current = buildCaseStats(attempts);
      presentNext();
    });
    return () => { cancelled = true; };
  }, [presentNext]);

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

  // Feed cube moves to the session and track for visualization
  useEffect(() => {
    const session = sessionRef.current;
    const onMove = (event: CubeMoveEvent) => {
      const moveStr = event.move.toString();
      session.onMove(moveStr, event.timestamp);
      if (session.phase === "solving" || session.phase === "presenting") {
        setMoves((prev) => [...prev, moveStr]);
      }
    };
    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection]);

  // Reset session on disconnect, re-present on reconnect
  useEffect(() => {
    const onStatus = (status: string) => {
      if (status === "disconnected") {
        sessionRef.current.reset();
        stopTimer();
        setPhase("idle");
        setCaseName(null);
        setCasePattern(null);
        setMoves([]);
        setTimerMs(0);
        setResult(null);
      } else if (status === "connected") {
        // Re-present a case if the session was reset by disconnect
        if (sessionRef.current.phase === "idle") {
          presentNext();
        }
      }
    };
    connection.addStatusListener(onStatus);
    return () => connection.removeStatusListener(onStatus);
  }, [connection, stopTimer, presentNext]);

  const skip = useCallback(() => {
    sessionRef.current.skip();
  }, []);

  const next = useCallback(() => {
    sessionRef.current.next();
  }, []);

  const retry = useCallback(async () => {
    const session = sessionRef.current;
    const lastResult = session.lastResult;
    stopTimer();
    await session.retry();
    setCaseName(session.currentCase?.name ?? null);
    setCasePattern(session.caseState);
    setCaseKey((k) => k + 1);
    setMoves([]);
    setTimerMs(0);
    setResult(null);
    setHintAlgorithm(lastResult?.algorithms[0] ?? null);
  }, [stopTimer]);

  return { phase, caseName, casePattern, caseKey, moves, timerMs, result, hintAlgorithm, skip, next, retry };
}
