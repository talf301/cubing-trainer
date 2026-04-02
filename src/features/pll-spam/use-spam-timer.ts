// src/features/pll-spam/use-spam-timer.ts
import { useState, useEffect, useRef } from "react";
import type { CubeConnection, CubeMoveEvent } from "@/core/cube-connection";
import {
  PllSpamSession,
  type PllSpamCompletion,
  type PllSpamDebugInfo,
} from "@/core/pll-spam-session";
import { PllSpamStore, type PllSpamAttempt } from "@/lib/pll-spam-store";

const spamStore = new PllSpamStore();

/** Maximum number of recent attempts to keep in the ephemeral list */
const MAX_RECENT = 50;

export interface SpamTimerState {
  /** The last completed attempt (for large time display) */
  lastAttempt: PllSpamCompletion | null;
  /** Ephemeral scrolling log of recent attempts (newest first) */
  recentAttempts: PllSpamCompletion[];
  /** Whether the last attempt was a personal best for that case */
  isPB: boolean;
  /** Debug info from the most recent move */
  debugInfo: PllSpamDebugInfo | null;
}

export function useSpamTimer(connection: CubeConnection): SpamTimerState {
  const sessionRef = useRef(new PllSpamSession());

  const [lastAttempt, setLastAttempt] = useState<PllSpamCompletion | null>(
    null,
  );
  const [recentAttempts, setRecentAttempts] = useState<PllSpamCompletion[]>([]);
  const [isPB, setIsPB] = useState(false);
  const [debugInfo, setDebugInfo] = useState<PllSpamDebugInfo | null>(null);

  // Track per-case best times for PB detection (loaded from DB on mount)
  const bestTimesRef = useRef<Map<string, number>>(new Map());

  // Load existing best times from DB on mount
  useEffect(() => {
    spamStore.getAllAttempts().then((attempts) => {
      const bests = new Map<string, number>();
      for (const a of attempts) {
        const current = bests.get(a.caseName);
        if (current === undefined || a.time < current) {
          bests.set(a.caseName, a.time);
        }
      }
      bestTimesRef.current = bests;
    });
  }, []);

  // Reset session on disconnect
  useEffect(() => {
    const onStatus = (status: string) => {
      if (status === "disconnected") {
        sessionRef.current.reset();
      }
    };
    connection.addStatusListener(onStatus);
    return () => connection.removeStatusListener(onStatus);
  }, [connection]);

  // Listen to completion events from the session
  useEffect(() => {
    const session = sessionRef.current;

    const onCompletion = (completion: PllSpamCompletion) => {
      // Check if this is a PB for the case
      const currentBest = bestTimesRef.current.get(completion.caseName);
      const isNewPB =
        currentBest === undefined || completion.time < currentBest;

      if (isNewPB) {
        bestTimesRef.current.set(completion.caseName, completion.time);
      }

      setLastAttempt(completion);
      setIsPB(isNewPB);
      setRecentAttempts((prev) =>
        [completion, ...prev].slice(0, MAX_RECENT),
      );

      // Persist to IndexedDB
      const attempt: PllSpamAttempt = {
        id: crypto.randomUUID(),
        caseName: completion.caseName,
        time: completion.time,
        moveCount: completion.moveCount,
        timestamp: completion.timestamp,
      };
      spamStore.addAttempt(attempt);
    };

    session.addCompletionListener(onCompletion);
    session.addDebugListener(setDebugInfo);
    return () => {
      session.removeCompletionListener(onCompletion);
      session.removeDebugListener(setDebugInfo);
    };
  }, []);

  // Feed cube moves to the session
  useEffect(() => {
    const session = sessionRef.current;

    const onMove = (event: CubeMoveEvent) => {
      const moveStr = event.move.toString();
      session.onMove(moveStr, event.timestamp, event.state);
    };

    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection]);

  return {
    lastAttempt,
    recentAttempts,
    isPB,
    debugInfo,
  };
}
