// src/features/pll-trainer/usePllRecognitionTrainer.ts
import { useState, useEffect, useCallback, useRef } from "react";
import {
  PllRecognitionSession,
  type RecognitionPhase,
} from "@/core/pll-recognition-session";
import { PllRecognitionStatsStore } from "@/lib/pll-recognition-stats-store";
import { PllRecognitionCaseSelector } from "@/core/pll-recognition-case-selector";
import { PllStickerCache } from "@/core/pll-sticker-cache";
import type { Color as FaceColor } from "@/core/pll-sticker-cache";
import type {
  Color as VisualColor,
  OverheadStickers as VisualOverheadStickers,
} from "@/core/pll-types";

/**
 * Maps face-identity colors ("U", "F", "R", "B", "L") from sticker cache
 * to visual colors ("white", "green", "red", "blue", "orange") for SVG rendering.
 * Uses Western color scheme.
 */
const FACE_TO_VISUAL: Record<FaceColor, VisualColor> = {
  U: "white",
  F: "green",
  R: "red",
  B: "blue",
  L: "orange",
};

function mapFaceToVisual(stickers: readonly FaceColor[]): VisualColor[] {
  return stickers.map((s) => FACE_TO_VISUAL[s]);
}

// Module-level singletons (same pattern as usePllTrainer)
const statsStore = new PllRecognitionStatsStore();
const caseSelector = new PllRecognitionCaseSelector();
const stickerCache = new PllStickerCache();

/** Auto-advance delay (ms) after correct answer in review phase */
const AUTO_ADVANCE_MS = 3000;

export function usePllRecognitionTrainer() {
  const sessionRef = useRef(
    new PllRecognitionSession(statsStore, caseSelector, stickerCache),
  );
  const [phase, setPhase] = useState<RecognitionPhase>("idle");
  const [stickers, setStickers] = useState<VisualColor[]>([]);
  const [options, setOptions] = useState<string[]>([]);
  const [currentCase, setCurrentCase] = useState<string | null>(null);
  const [answerGiven, setAnswerGiven] = useState<string | null>(null);
  const [correct, setCorrect] = useState(false);
  const [recognitionTime, setRecognitionTime] = useState(0);
  const [overheadStickers, setOverheadStickers] =
    useState<VisualOverheadStickers | null>(null);
  const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Listen to phase changes from the session
  useEffect(() => {
    const session = sessionRef.current;

    const onPhase = (newPhase: RecognitionPhase) => {
      setPhase(newPhase);

      if (newPhase === "presenting") {
        // Map face-identity stickers to visual colors for CornerView
        setStickers(mapFaceToVisual(session.stickers));

        // Build shuffled 3x2 grid: correct answer + 5 distractors
        const allOptions = [session.currentCase!, ...session.distractors];
        shuffleArray(allOptions);
        setOptions(allOptions);

        setCurrentCase(session.currentCase);
        setAnswerGiven(null);
        setCorrect(false);
        setRecognitionTime(0);
        setOverheadStickers(null);

        // Clear any leftover auto-advance timer
        if (autoAdvanceRef.current) {
          clearTimeout(autoAdvanceRef.current);
          autoAdvanceRef.current = null;
        }
      }

      if (newPhase === "review") {
        setAnswerGiven(session.answerGiven);
        setCorrect(session.correct);
        setRecognitionTime(session.recognitionTime);
        setCurrentCase(session.currentCase);

        // Fetch overhead stickers for the review diagram (canonical, no AUF)
        stickerCache
          .getOverheadStickers(session.currentCase!, "")
          .then((overhead) => {
            const visual: VisualOverheadStickers = {
              // U face is all white in PLL (OLL already solved)
              u: Array(9).fill("white") as VisualColor[],
              front: mapFaceToVisual(overhead.front) as [
                VisualColor,
                VisualColor,
                VisualColor,
              ],
              right: mapFaceToVisual(overhead.right) as [
                VisualColor,
                VisualColor,
                VisualColor,
              ],
              back: mapFaceToVisual(overhead.back) as [
                VisualColor,
                VisualColor,
                VisualColor,
              ],
              left: mapFaceToVisual(overhead.left) as [
                VisualColor,
                VisualColor,
                VisualColor,
              ],
            };
            setOverheadStickers(visual);
          });

        // Auto-advance after 3s on correct, manual next on wrong
        if (session.correct) {
          autoAdvanceRef.current = setTimeout(() => {
            session.next();
          }, AUTO_ADVANCE_MS);
        }
      }
    };

    session.addPhaseListener(onPhase);
    return () => {
      session.removePhaseListener(onPhase);
      if (autoAdvanceRef.current) clearTimeout(autoAdvanceRef.current);
    };
  }, []);

  const start = useCallback(async () => {
    await sessionRef.current.start();
  }, []);

  const answer = useCallback(async (caseName: string) => {
    await sessionRef.current.answer(caseName);
  }, []);

  /** Skip auto-advance timer and go to next case immediately */
  const next = useCallback(async () => {
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current);
      autoAdvanceRef.current = null;
    }
    await sessionRef.current.next();
  }, []);

  return {
    phase,
    stickers,
    options,
    currentCase,
    answerGiven,
    correct,
    recognitionTime,
    overheadStickers,
    start,
    answer,
    next,
  };
}

/** Fisher-Yates shuffle (in place) */
function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
