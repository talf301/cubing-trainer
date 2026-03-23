import type { PllCaseStats } from "../lib/pll-stats-store";

/**
 * Extended stats used by the case selector. Adds lastAttemptAt
 * (epoch ms) which getAllStats() doesn't provide — the caller
 * must enrich the data before passing it in.
 */
export interface PllCaseWeight extends PllCaseStats {
  lastAttemptAt: number; // 0 means never attempted
}

const WEIGHT_AVG_TIME = 0.4;
const WEIGHT_LOW_ATTEMPTS = 0.2;
const WEIGHT_TWO_LOOK = 0.25;
const WEIGHT_STALENESS = 0.15;

/**
 * Weighted random PLL case selector.
 *
 * Given enriched stats for each known case, computes a composite
 * weight and returns a weighted-random case name.  Returns null if
 * the input list is empty.
 */
export class PllCaseSelector {
  /**
   * Pick a case via weighted random selection.
   * @param cases - enriched stats for every known case
   * @param now   - current timestamp (epoch ms), defaults to Date.now()
   * @returns case name, or null if no cases supplied
   */
  select(cases: PllCaseWeight[], now: number = Date.now()): string | null {
    if (cases.length === 0) return null;
    if (cases.length === 1) return cases[0].caseName;

    const weights = cases.map((c) => this.computeWeight(c, cases, now));
    return weightedRandomPick(cases, weights);
  }

  /** Visible for testing. */
  computeWeight(
    c: PllCaseWeight,
    allCases: PllCaseWeight[],
    now: number,
  ): number {
    const avgScore = normalizedAvgTime(c, allCases);
    const attemptScore = lowAttemptScore(c.attemptCount);
    const twoLookScore = c.twoLookRate;
    const stalenessScore = normalizedStaleness(c, allCases, now);

    return (
      WEIGHT_AVG_TIME * avgScore +
      WEIGHT_LOW_ATTEMPTS * attemptScore +
      WEIGHT_TWO_LOOK * twoLookScore +
      WEIGHT_STALENESS * stalenessScore
    );
  }
}

/**
 * `(case_avg - min_avg) / (max_avg - min_avg)`.
 * Cases with 0 attempts treated as max (1.0).
 * If all averages are equal, returns 0.5 for attempted cases.
 */
function normalizedAvgTime(
  c: PllCaseWeight,
  all: PllCaseWeight[],
): number {
  if (c.attemptCount === 0) return 1.0;

  const attempted = all.filter((x) => x.attemptCount > 0);
  if (attempted.length === 0) return 1.0;

  const avgs = attempted.map((x) => x.avgTime);
  const min = Math.min(...avgs);
  const max = Math.max(...avgs);
  const range = max - min;

  if (range === 0) return 0.5;
  return (c.avgTime - min) / range;
}

/**
 * `1 / log(attempts + 1)` per spec.  We use `log(attempts + 2)` so
 * that 0 attempts yields a finite value (log(2)) rather than log(1)=0.
 * Monotonically decreasing: fewer attempts → higher score.
 */
function lowAttemptScore(attempts: number): number {
  return 1 / Math.log(attempts + 2);
}

/**
 * Time since last drilled, normalized across all cases.
 * Cases never attempted get score 1.0.
 */
function normalizedStaleness(
  c: PllCaseWeight,
  all: PllCaseWeight[],
  now: number,
): number {
  if (c.lastAttemptAt === 0) return 1.0;

  const staleness = now - c.lastAttemptAt;
  const stalenesses = all.map((x) =>
    x.lastAttemptAt === 0 ? staleness : now - x.lastAttemptAt,
  );

  const min = Math.min(...stalenesses);
  const max = Math.max(...stalenesses);
  const range = max - min;

  if (range === 0) return 0.5;
  return (staleness - min) / range;
}

function weightedRandomPick(
  cases: PllCaseWeight[],
  weights: number[],
): string {
  // Ensure all weights are positive (add small epsilon)
  const adjusted = weights.map((w) => Math.max(w, 0.001));
  const total = adjusted.reduce((sum, w) => sum + w, 0);
  let r = Math.random() * total;

  for (let i = 0; i < cases.length; i++) {
    r -= adjusted[i];
    if (r <= 0) return cases[i].caseName;
  }
  // Fallback (floating point edge case)
  return cases[cases.length - 1].caseName;
}
