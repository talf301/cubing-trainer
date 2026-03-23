// src/features/pll-trainer/usePllTrainer.ts
import { useState, useEffect, useCallback, useRef } from "react";
import type { CubeConnection, CubeMoveEvent } from "@/core/cube-connection";
import {
  PllDrillSession,
  type DrillPhase,
  type PllCaseSelectorInterface,
} from "@/core/pll-drill-session";
import { PllLearnSession, type LearnPhase } from "@/core/pll-learn-session";
import { PllStatsStore, type PllCaseStats } from "@/lib/pll-stats-store";
import { PllCaseSelector, type PllCaseWeight } from "@/core/pll-case-selector";
import { PLL_CASES } from "@/core/pll-cases";

export type PllTab = "drill" | "learn";

const statsStore = new PllStatsStore();
const caseSelector = new PllCaseSelector();

/** Adapter that bridges PllCaseSelector to the PllCaseSelectorInterface expected by PllDrillSession */
class CaseSelectorAdapter implements PllCaseSelectorInterface {
  async selectCase(): Promise<string> {
    const allStats = await statsStore.getAllStats();

    // Enrich with lastAttemptAt by looking at most recent attempt per case
    const enriched: PllCaseWeight[] = await Promise.all(
      allStats.map(async (s) => {
        const attempts = await statsStore.getAttemptsForCase(s.caseName);
        const lastAttemptAt =
          attempts.length > 0
            ? Math.max(...attempts.map((a) => a.timestamp))
            : 0;
        return { ...s, lastAttemptAt };
      }),
    );

    const picked = caseSelector.select(enriched);
    if (!picked) throw new Error("No known cases to select from");
    return picked;
  }
}

const selectorAdapter = new CaseSelectorAdapter();

export function usePllTrainer(connection: CubeConnection) {
  const [tab, setTab] = useState<PllTab>("drill");
  const [knownCases, setKnownCases] = useState<Set<string>>(new Set());
  const [showKnownModal, setShowKnownModal] = useState(false);
  const [hasLoadedKnown, setHasLoadedKnown] = useState(false);

  // Drill state
  const drillRef = useRef(new PllDrillSession(statsStore, selectorAdapter));
  const [drillPhase, setDrillPhase] = useState<DrillPhase>("idle");
  const [drillDisplayMs, setDrillDisplayMs] = useState(0);
  const drillTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const drillStartWallRef = useRef(0);
  const [drillStats, setDrillStats] = useState<PllCaseStats | null>(null);

  // Learn state
  const learnRef = useRef(new PllLearnSession());
  const [learnPhase, setLearnPhase] = useState<LearnPhase>("idle");
  const [learnPosition, setLearnPosition] = useState(0);
  const [learnReps, setLearnReps] = useState(0);
  const [learnCompletions, setLearnCompletions] = useState(0);
  const [learnNeedsUndo, setLearnNeedsUndo] = useState<string | null>(null);

  // Load known cases on mount
  useEffect(() => {
    statsStore.getKnownCases().then((cases) => {
      const names = new Set(cases.map((c) => c.name));
      setKnownCases(names);
      setHasLoadedKnown(true);
      // Show modal on first visit if no known cases
      if (names.size === 0) {
        setShowKnownModal(true);
      }
    });
  }, []);

  // Toggle known case
  const toggleKnownCase = useCallback(
    async (caseName: string) => {
      if (knownCases.has(caseName)) {
        await statsStore.removeKnownCase(caseName);
        setKnownCases((prev) => {
          const next = new Set(prev);
          next.delete(caseName);
          return next;
        });
      } else {
        await statsStore.addKnownCase(caseName);
        setKnownCases((prev) => new Set(prev).add(caseName));
      }
    },
    [knownCases],
  );

  // --- Drill mode ---

  // Listen to drill phase changes
  useEffect(() => {
    const drill = drillRef.current;
    const onPhase = (phase: DrillPhase) => {
      setDrillPhase(phase);

      if (phase === "solving") {
        drillStartWallRef.current = Date.now();
        drillTimerRef.current = setInterval(() => {
          setDrillDisplayMs(Date.now() - drillStartWallRef.current);
        }, 10);
      }

      if (phase === "review") {
        if (drillTimerRef.current) {
          clearInterval(drillTimerRef.current);
          drillTimerRef.current = null;
        }
        setDrillDisplayMs(drill.duration);
        // Load stats for the reviewed case
        if (drill.currentCase) {
          statsStore.getStatsForCase(drill.currentCase).then(setDrillStats);
        }
      }
    };

    drill.addPhaseListener(onPhase);
    return () => {
      drill.removePhaseListener(onPhase);
      if (drillTimerRef.current) clearInterval(drillTimerRef.current);
    };
  }, []);

  const startDrill = useCallback(async () => {
    setDrillDisplayMs(0);
    setDrillStats(null);
    await drillRef.current.startNextCase();
  }, []);

  // Feed cube moves to drill session
  useEffect(() => {
    if (tab !== "drill") return;
    const drill = drillRef.current;

    const onMove = (event: CubeMoveEvent) => {
      const moveStr = event.move.toString();

      if (drill.phase === "scrambling") {
        drill.onCubeState(event.state);
      } else if (drill.phase === "ready" || drill.phase === "solving") {
        drill.onMove(moveStr, event.timestamp, event.state);
      }
    };

    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection, tab]);

  // --- Learn mode ---

  // Listen to learn phase changes
  useEffect(() => {
    const learn = learnRef.current;
    const onPhase = (phase: LearnPhase) => {
      setLearnPhase(phase);
      setLearnPosition(learn.position);
      setLearnReps(learn.reps);
      setLearnCompletions(learn.completions);
      setLearnNeedsUndo(learn.needsUndo);
    };

    learn.addPhaseListener(onPhase);
    return () => learn.removePhaseListener(onPhase);
  }, []);

  const startLearnCase = useCallback((caseName: string) => {
    learnRef.current.startPractice(caseName);
    setLearnPhase("practicing");
    setLearnPosition(0);
    setLearnReps(0);
    setLearnCompletions(0);
    setLearnNeedsUndo(null);
  }, []);

  const startLearnTest = useCallback(() => {
    learnRef.current.startTest();
  }, []);

  const addLearnedCaseToKnown = useCallback(async () => {
    const caseName = learnRef.current.caseName;
    if (caseName) {
      await statsStore.addKnownCase(caseName);
      setKnownCases((prev) => new Set(prev).add(caseName));
    }
    learnRef.current.reset();
    setLearnPhase("idle");
  }, []);

  const resetLearn = useCallback(() => {
    learnRef.current.reset();
    setLearnPhase("idle");
  }, []);

  // Feed cube moves to learn session
  useEffect(() => {
    if (tab !== "learn") return;
    const learn = learnRef.current;

    const onMove = (event: CubeMoveEvent) => {
      const moveStr = event.move.toString();
      if (learn.phase === "practicing" || learn.phase === "testing") {
        learn.onMove(moveStr);
        setLearnPosition(learn.position);
        setLearnReps(learn.reps);
        setLearnCompletions(learn.completions);
        setLearnNeedsUndo(learn.needsUndo);
      }
    };

    connection.addMoveListener(onMove);
    return () => connection.removeMoveListener(onMove);
  }, [connection, tab]);

  // Unknown cases for learn mode (cases not in known set)
  const unknownCases = Object.keys(PLL_CASES).filter(
    (name) => !knownCases.has(name),
  );

  return {
    // Tab
    tab,
    setTab,

    // Known cases modal
    knownCases,
    showKnownModal,
    setShowKnownModal,
    toggleKnownCase,
    hasLoadedKnown,

    // Drill
    drillPhase,
    drillDisplayMs,
    drillSession: drillRef.current,
    drillStats,
    startDrill,

    // Learn
    learnPhase,
    learnPosition,
    learnReps,
    learnCompletions,
    learnNeedsUndo,
    learnSession: learnRef.current,
    unknownCases,
    startLearnCase,
    startLearnTest,
    addLearnedCaseToKnown,
    resetLearn,
  };
}
