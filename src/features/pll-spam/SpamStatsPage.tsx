// src/features/pll-spam/SpamStatsPage.tsx
import { useState, useEffect } from "react";
import { PLL_CASES } from "@/core/pll-cases";
import { PllSpamStore, type PllSpamAttempt } from "@/lib/pll-spam-store";
import { topPercentMetric, sparklineData } from "@/lib/pll-spam-stats";

const ALL_PLL_NAMES = Object.keys(PLL_CASES);
const store = new PllSpamStore();

interface CaseStats {
  caseName: string;
  attempts: number;
  topFivePercent: number;
  sparkline: number[];
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

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;

  const width = 80;
  const height = 24;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      // Invert Y: lower times (faster) should be higher on screen
      const y = height - ((v - min) / range) * (height - 2) - 1;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      width={width}
      height={height}
      className="inline-block"
      viewBox={`0 0 ${width} ${height}`}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
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

export function SpamStatsPage() {
  const [caseStats, setCaseStats] = useState<CaseStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      const allAttempts = await store.getAllAttempts();

      // Group by case
      const byCase = new Map<string, PllSpamAttempt[]>();
      for (const attempt of allAttempts) {
        const existing = byCase.get(attempt.caseName) ?? [];
        existing.push(attempt);
        byCase.set(attempt.caseName, existing);
      }

      const stats: CaseStats[] = ALL_PLL_NAMES.map((caseName) => {
        const attempts = byCase.get(caseName) ?? [];
        // Sort by timestamp for sparkline chronological order
        const sorted = [...attempts].sort((a, b) => a.timestamp - b.timestamp);
        const times = sorted.map((a) => a.time);
        return {
          caseName,
          attempts: attempts.length,
          topFivePercent: topPercentMetric(times),
          sparkline: sparklineData(times),
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

  // Separate cases with and without attempts
  const withAttempts = caseStats
    .filter((s) => s.attempts > 0)
    .sort((a, b) => a.topFivePercent - b.topFivePercent);
  const withoutAttempts = caseStats.filter((s) => s.attempts === 0);

  const totalAttempts = caseStats.reduce((sum, s) => sum + s.attempts, 0);
  const casesCovered = withAttempts.length;

  // Overall top-5% average: mean of per-case metrics for practiced cases
  const overallAvg =
    withAttempts.length > 0
      ? withAttempts.reduce((sum, s) => sum + s.topFivePercent, 0) /
        withAttempts.length
      : NaN;

  // Color range from user's own stats
  const fastest = withAttempts.length > 0 ? withAttempts[0].topFivePercent : 0;
  const slowest =
    withAttempts.length > 0
      ? withAttempts[withAttempts.length - 1].topFivePercent
      : 0;

  const ranked = [...withAttempts, ...withoutAttempts];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">Total Attempts</p>
          <p className="text-2xl font-bold">{totalAttempts}</p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">Overall Top-5% Avg</p>
          <p className="text-2xl font-bold">
            {Number.isNaN(overallAvg) ? "—" : formatTime(overallAvg)}
          </p>
        </div>
        <div className="rounded-lg bg-gray-800 p-4 text-center">
          <p className="text-sm text-gray-400">Cases Covered</p>
          <p className="text-2xl font-bold">
            {casesCovered}/{ALL_PLL_NAMES.length}
          </p>
        </div>
      </div>

      {/* Ranked list */}
      <div>
        <h2 className="mb-3 text-lg font-semibold">PLL Rankings</h2>
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
                  className={`w-10 font-semibold ${
                    hasAttempts ? "text-gray-200" : "text-gray-600"
                  }`}
                >
                  {stat.caseName}
                </span>

                {/* Top-5% time */}
                <span
                  className={`w-20 font-mono tabular-nums ${
                    hasAttempts
                      ? colorForMetric(stat.topFivePercent, fastest, slowest)
                      : "text-gray-600"
                  }`}
                >
                  {hasAttempts ? formatTime(stat.topFivePercent) : "—"}
                </span>

                {/* Attempt count */}
                <span
                  className={`w-16 text-sm ${
                    hasAttempts ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {hasAttempts ? `${stat.attempts} att.` : "0 att."}
                </span>

                {/* Sparkline */}
                <span
                  className={`flex-1 ${hasAttempts ? "text-blue-400" : "text-gray-600"}`}
                >
                  <Sparkline data={stat.sparkline} />
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
