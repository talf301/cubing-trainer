// src/features/f2l-trainer/F2LStatsPage.tsx
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { F2L_CASES } from "@/core/f2l-cases";
import {
  F2LSolutionStore,
  type F2LSolutionAttempt,
} from "@/lib/f2l-solution-store";

const ALL_F2L_NAMES = F2L_CASES.map((c) => c.name);
const store = new F2LSolutionStore();

/** Canonical move count for each case (space-separated moves). */
const OPTIMAL_MOVES = new Map(
  F2L_CASES.map((c) => [c.name, Math.min(...c.algorithms.map((a) => a.split(/\s+/).length))]),
);

interface CaseStats {
  caseName: string;
  attempts: number;
  avgTime: number;
  bestTime: number;
  avgMoveCount: number;
  optimalMoveCount: number;
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

export function F2LStatsPage() {
  const [caseStats, setCaseStats] = useState<CaseStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const allAttempts = await store.getAllAttempts();

      // Group by case
      const byCase = new Map<string, F2LSolutionAttempt[]>();
      for (const attempt of allAttempts) {
        const existing = byCase.get(attempt.caseName) ?? [];
        existing.push(attempt);
        byCase.set(attempt.caseName, existing);
      }

      const stats: CaseStats[] = ALL_F2L_NAMES.map((caseName) => {
        const attempts = byCase.get(caseName) ?? [];
        const times = attempts.map((a) => a.time);
        const moveCounts = attempts.map((a) => a.moveCount);

        return {
          caseName,
          attempts: attempts.length,
          avgTime:
            times.length > 0
              ? times.reduce((s, t) => s + t, 0) / times.length
              : 0,
          bestTime: times.length > 0 ? Math.min(...times) : 0,
          avgMoveCount:
            moveCounts.length > 0
              ? moveCounts.reduce((s, m) => s + m, 0) / moveCounts.length
              : 0,
          optimalMoveCount: OPTIMAL_MOVES.get(caseName) ?? 0,
        };
      });

      setCaseStats(stats);
      setLoading(false);
    }

    loadStats();
  }, []);

  if (loading) {
    return <p className="text-center text-gray-400">Loading stats…</p>;
  }

  // Sort by weakness: slowest avg time first (cases with attempts), then unattempted
  const withAttempts = caseStats
    .filter((s) => s.attempts > 0)
    .sort((a, b) => b.avgTime - a.avgTime);
  const withoutAttempts = caseStats.filter((s) => s.attempts === 0);

  const totalAttempts = caseStats.reduce((sum, s) => sum + s.attempts, 0);
  const casesCovered = withAttempts.length;

  // Color range from user's own stats (fastest to slowest avg)
  const fastest =
    withAttempts.length > 0
      ? withAttempts[withAttempts.length - 1].avgTime
      : 0;
  const slowest = withAttempts.length > 0 ? withAttempts[0].avgTime : 0;

  const ranked = [...withAttempts, ...withoutAttempts];

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/training/f2l"
        className="text-blue-400 hover:text-blue-300"
      >
        ← Back to F2L Trainer
      </Link>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">Total Attempts</p>
          <p className="text-2xl font-bold">{totalAttempts}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">Cases Covered</p>
          <p className="text-2xl font-bold">
            {casesCovered}/{ALL_F2L_NAMES.length}
          </p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">Overall Avg</p>
          <p className="text-2xl font-bold">
            {withAttempts.length > 0
              ? formatTime(
                  withAttempts.reduce((s, c) => s + c.avgTime, 0) /
                    withAttempts.length,
                )
              : "—"}
          </p>
        </div>
      </div>

      {/* Ranked list — sorted by weakness (slowest first) */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">F2L Case Rankings</h2>
        <div className="space-y-1">
          {ranked.map((stat, i) => {
            const hasAttempts = stat.attempts > 0;
            const rank = hasAttempts ? i + 1 : null;

            return (
              <div
                key={stat.caseName}
                className={`flex items-center gap-4 rounded px-4 py-2 ${
                  hasAttempts ? "bg-gray-800" : "bg-gray-800/40"
                }`}
              >
                {/* Rank */}
                <span
                  className={`w-8 text-right font-mono text-sm ${
                    hasAttempts ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {rank ?? "—"}
                </span>

                {/* Case name */}
                <span
                  className={`w-16 font-semibold ${
                    hasAttempts ? "text-gray-200" : "text-gray-600"
                  }`}
                >
                  {stat.caseName}
                </span>

                {/* Attempt count */}
                <span
                  className={`w-16 text-sm ${
                    hasAttempts ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {stat.attempts} att.
                </span>

                {/* Avg time */}
                <span
                  className={`w-20 font-mono tabular-nums ${
                    hasAttempts
                      ? colorForMetric(stat.avgTime, fastest, slowest)
                      : "text-gray-600"
                  }`}
                >
                  {hasAttempts ? formatTime(stat.avgTime) : "—"}
                </span>

                {/* Best time */}
                <span
                  className={`w-20 font-mono tabular-nums ${
                    hasAttempts ? "text-gray-300" : "text-gray-600"
                  }`}
                >
                  {hasAttempts ? formatTime(stat.bestTime) : "—"}
                </span>

                {/* Avg moves vs optimal */}
                <span
                  className={`flex-1 text-sm ${
                    hasAttempts ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {hasAttempts
                    ? `${stat.avgMoveCount.toFixed(1)} / ${stat.optimalMoveCount} moves`
                    : `— / ${stat.optimalMoveCount} moves`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
