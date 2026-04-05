// src/features/ll-trainer/LLStatsPage.tsx
import { useState, useEffect } from "react";
import { OLL_CASES } from "@/core/oll-cases";
import { PLL_CASES } from "@/core/pll-cases";
import {
  LLPracticeStore,
  type LLPracticeAttempt,
} from "@/lib/ll-practice-store";
import type { LLPhaseSegment } from "@/core/ll-practice-session";

const ALL_OLL_NAMES = Object.keys(OLL_CASES);
const ALL_PLL_NAMES = Object.keys(PLL_CASES);
const store = new LLPracticeStore();

interface CaseStats {
  caseName: string;
  attempts: number;
  avgTime: number;
  avgRecognition: number;
  avgExecution: number;
  oneLookRate: number;
}

function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) {
    return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
  }
  return seconds.toFixed(2);
}

function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

function colorForMetric(
  value: number,
  fastest: number,
  slowest: number,
): string {
  if (fastest === slowest) return "text-gray-200";
  const ratio = (value - fastest) / (slowest - fastest);
  if (ratio < 0.33) return "text-green-400";
  if (ratio < 0.67) return "text-yellow-400";
  return "text-red-400";
}

/**
 * Aggregate per-case stats from a list of segments grouped by case name.
 * Each attempt contributes all segments for that phase; 1-look means the attempt
 * had exactly 1 segment in this phase.
 */
function buildCaseStats(
  allNames: string[],
  segmentsByCase: Map<string, LLPhaseSegment[]>,
  oneLookByCase: Map<string, { total: number; oneLook: number }>,
): CaseStats[] {
  return allNames.map((caseName) => {
    const segments = segmentsByCase.get(caseName) ?? [];
    const lookInfo = oneLookByCase.get(caseName) ?? { total: 0, oneLook: 0 };
    if (segments.length === 0) {
      return {
        caseName,
        attempts: 0,
        avgTime: NaN,
        avgRecognition: NaN,
        avgExecution: NaN,
        oneLookRate: NaN,
      };
    }
    const totalTime = segments.reduce(
      (s, seg) => s + seg.recognitionTime + seg.executionTime,
      0,
    );
    const totalRec = segments.reduce((s, seg) => s + seg.recognitionTime, 0);
    const totalExec = segments.reduce((s, seg) => s + seg.executionTime, 0);
    return {
      caseName,
      attempts: segments.length,
      avgTime: totalTime / segments.length,
      avgRecognition: totalRec / segments.length,
      avgExecution: totalExec / segments.length,
      oneLookRate: lookInfo.total > 0 ? lookInfo.oneLook / lookInfo.total : NaN,
    };
  });
}

function CaseTable({
  title,
  stats,
}: {
  title: string;
  stats: CaseStats[];
}) {
  const withAttempts = stats
    .filter((s) => s.attempts > 0)
    .sort((a, b) => b.avgTime - a.avgTime); // slowest (weakest) first
  const withoutAttempts = stats.filter((s) => s.attempts === 0);

  const fastest =
    withAttempts.length > 0
      ? Math.min(...withAttempts.map((s) => s.avgTime))
      : 0;
  const slowest =
    withAttempts.length > 0
      ? Math.max(...withAttempts.map((s) => s.avgTime))
      : 0;

  const ranked = [...withAttempts, ...withoutAttempts];

  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {/* Header */}
      <div className="flex items-center gap-4 px-4 py-1 text-xs text-gray-500">
        <span className="w-20">Case</span>
        <span className="w-12 text-right">Count</span>
        <span className="w-16 text-right">Avg</span>
        <span className="w-16 text-right">Recog</span>
        <span className="w-16 text-right">Exec</span>
        <span className="w-16 text-right">1-Look</span>
      </div>
      <div className="space-y-1">
        {ranked.map((stat) => {
          const has = stat.attempts > 0;
          return (
            <div
              key={stat.caseName}
              className={`flex items-center gap-4 rounded px-4 py-2 ${
                has ? "bg-gray-800" : "bg-gray-800/40"
              }`}
            >
              {/* Case name */}
              <span
                className={`w-20 font-semibold ${
                  has ? "text-gray-200" : "text-gray-600"
                }`}
              >
                {stat.caseName}
              </span>

              {/* Attempt count */}
              <span
                className={`w-12 text-right font-mono text-sm ${
                  has ? "text-gray-400" : "text-gray-600"
                }`}
              >
                {stat.attempts}
              </span>

              {/* Average time */}
              <span
                className={`w-16 text-right font-mono tabular-nums ${
                  has
                    ? colorForMetric(stat.avgTime, fastest, slowest)
                    : "text-gray-600"
                }`}
              >
                {has ? formatTime(stat.avgTime) : "\u2014"}
              </span>

              {/* Recognition time */}
              <span
                className={`w-16 text-right font-mono tabular-nums ${
                  has ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {has ? formatTime(stat.avgRecognition) : "\u2014"}
              </span>

              {/* Execution time */}
              <span
                className={`w-16 text-right font-mono tabular-nums ${
                  has ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {has ? formatTime(stat.avgExecution) : "\u2014"}
              </span>

              {/* 1-look rate */}
              <span
                className={`w-16 text-right font-mono text-sm ${
                  has ? "text-gray-300" : "text-gray-600"
                }`}
              >
                {has && !Number.isNaN(stat.oneLookRate)
                  ? formatPercent(stat.oneLookRate)
                  : "\u2014"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LLStatsPage() {
  const [attempts, setAttempts] = useState<LLPracticeAttempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const all = await store.getAllAttempts();
      setAttempts(all);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <p className="text-center text-gray-400">Loading stats...</p>;
  }

  // ---- Summary stats ----
  const totalAttempts = attempts.length;
  const avgLLTime =
    totalAttempts > 0
      ? attempts.reduce((s, a) => s + a.totalTime, 0) / totalAttempts
      : NaN;
  const avgOLLTime =
    totalAttempts > 0
      ? attempts.reduce((s, a) => s + a.ollTime, 0) / totalAttempts
      : NaN;
  const avgPLLTime =
    totalAttempts > 0
      ? attempts.reduce((s, a) => s + a.pllTime, 0) / totalAttempts
      : NaN;

  const oneLookOLLCount = attempts.filter(
    (a) => a.ollSegments.length === 1,
  ).length;
  const oneLookPLLCount = attempts.filter(
    (a) => a.pllSegments.length === 1,
  ).length;
  const oneLookOLLRate =
    totalAttempts > 0 ? oneLookOLLCount / totalAttempts : NaN;
  const oneLookPLLRate =
    totalAttempts > 0 ? oneLookPLLCount / totalAttempts : NaN;

  // ---- Per-case stats ----
  // Collect segments by case name and track 1-look per attempt
  const ollSegmentsByCase = new Map<string, LLPhaseSegment[]>();
  const pllSegmentsByCase = new Map<string, LLPhaseSegment[]>();
  const ollOneLookByCase = new Map<
    string,
    { total: number; oneLook: number }
  >();
  const pllOneLookByCase = new Map<
    string,
    { total: number; oneLook: number }
  >();

  for (const attempt of attempts) {
    // OLL segments
    for (const seg of attempt.ollSegments) {
      const existing = ollSegmentsByCase.get(seg.caseName) ?? [];
      existing.push(seg);
      ollSegmentsByCase.set(seg.caseName, existing);
    }
    // Track 1-look OLL: for each case that appears in this attempt's OLL,
    // count whether this attempt was a 1-look OLL
    const ollIsOneLook = attempt.ollSegments.length === 1;
    const ollCasesSeen = new Set(attempt.ollSegments.map((s) => s.caseName));
    for (const caseName of ollCasesSeen) {
      const info = ollOneLookByCase.get(caseName) ?? { total: 0, oneLook: 0 };
      info.total++;
      if (ollIsOneLook) info.oneLook++;
      ollOneLookByCase.set(caseName, info);
    }

    // PLL segments
    for (const seg of attempt.pllSegments) {
      const existing = pllSegmentsByCase.get(seg.caseName) ?? [];
      existing.push(seg);
      pllSegmentsByCase.set(seg.caseName, existing);
    }
    const pllIsOneLook = attempt.pllSegments.length === 1;
    const pllCasesSeen = new Set(attempt.pllSegments.map((s) => s.caseName));
    for (const caseName of pllCasesSeen) {
      const info = pllOneLookByCase.get(caseName) ?? { total: 0, oneLook: 0 };
      info.total++;
      if (pllIsOneLook) info.oneLook++;
      pllOneLookByCase.set(caseName, info);
    }
  }

  const ollCaseStats = buildCaseStats(
    ALL_OLL_NAMES,
    ollSegmentsByCase,
    ollOneLookByCase,
  );
  const pllCaseStats = buildCaseStats(
    ALL_PLL_NAMES,
    pllSegmentsByCase,
    pllOneLookByCase,
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">Total Attempts</p>
          <p className="text-2xl font-bold">{totalAttempts}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">Avg LL Time</p>
          <p className="text-2xl font-bold">
            {Number.isNaN(avgLLTime) ? "\u2014" : formatTime(avgLLTime)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">Avg OLL / PLL</p>
          <p className="text-2xl font-bold">
            {Number.isNaN(avgOLLTime) ? "\u2014" : formatTime(avgOLLTime)}
            {" / "}
            {Number.isNaN(avgPLLTime) ? "\u2014" : formatTime(avgPLLTime)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">1-Look OLL</p>
          <p className="text-2xl font-bold">
            {Number.isNaN(oneLookOLLRate)
              ? "\u2014"
              : formatPercent(oneLookOLLRate)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">1-Look PLL</p>
          <p className="text-2xl font-bold">
            {Number.isNaN(oneLookPLLRate)
              ? "\u2014"
              : formatPercent(oneLookPLLRate)}
          </p>
        </div>
      </div>

      {/* Per-case tables */}
      <CaseTable title="OLL Cases" stats={ollCaseStats} />
      <CaseTable title="PLL Cases" stats={pllCaseStats} />
    </div>
  );
}
