/**
 * Stats shape expected from PllRecognitionStatsStore.getAllStats().
 * Defined here until the stats store (separate task) lands; the store
 * will re-export or satisfy this same shape.
 */
export interface PllRecognitionCaseStats {
  caseName: string;
  attemptCount: number;
  accuracy: number; // 0-1 (correct / total)
  avgTime: number; // ms (average recognition time)
}

/**
 * Extended stats used by the recognition case selector.
 * Adds lastAttemptAt (epoch ms) — the caller must enrich the data
 * before passing it in, since getAllStats() doesn't provide it.
 */
export interface PllRecognitionCaseWeight extends PllRecognitionCaseStats {
  lastAttemptAt: number; // 0 means never attempted
}

const WEIGHT_ACCURACY = 0.4;
const WEIGHT_AVG_TIME = 0.25;
const WEIGHT_LOW_ATTEMPTS = 0.2;
const WEIGHT_STALENESS = 0.15;

/**
 * Weighted random PLL recognition case selector.
 *
 * Given enriched stats for each case, computes a composite weight
 * and returns a weighted-random case name.  Returns null if the
 * input list is empty.
 */
export class PllRecognitionCaseSelector {
  /**
   * Pick a case via weighted random selection.
   * @param cases - enriched stats for every known case
   * @param now   - current timestamp (epoch ms), defaults to Date.now()
   * @returns case name, or null if no cases supplied
   */
  select(
    cases: PllRecognitionCaseWeight[],
    now: number = Date.now(),
  ): string | null {
    if (cases.length === 0) return null;
    if (cases.length === 1) return cases[0].caseName;

    const weights = cases.map((c) => this.computeWeight(c, cases, now));
    return weightedRandomPick(cases, weights);
  }

  /** Visible for testing. */
  computeWeight(
    c: PllRecognitionCaseWeight,
    allCases: PllRecognitionCaseWeight[],
    now: number,
  ): number {
    const accuracyScore = accuracyWeight(c);
    const avgScore = normalizedAvgTime(c, allCases);
    const attemptScore = lowAttemptScore(c.attemptCount);
    const stalenessScore = normalizedStaleness(c, allCases, now);

    return (
      WEIGHT_ACCURACY * accuracyScore +
      WEIGHT_AVG_TIME * avgScore +
      WEIGHT_LOW_ATTEMPTS * attemptScore +
      WEIGHT_STALENESS * stalenessScore
    );
  }
}

/**
 * `1 - accuracy` — lower accuracy → higher weight.
 * Cases with 0 attempts get score 1.0.
 */
function accuracyWeight(c: PllRecognitionCaseWeight): number {
  if (c.attemptCount === 0) return 1.0;
  return 1 - c.accuracy;
}

/**
 * `(case_avg - min_avg) / (max_avg - min_avg)`.
 * Cases with 0 attempts treated as max (1.0).
 * If all averages are equal, returns 0.5 for attempted cases.
 */
function normalizedAvgTime(
  c: PllRecognitionCaseWeight,
  all: PllRecognitionCaseWeight[],
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
 * `1 / log(attempts + 2)` — fewer attempts → higher score.
 * We use `log(attempts + 2)` so that 0 attempts yields a finite
 * value (log(2)) rather than log(1)=0.
 */
function lowAttemptScore(attempts: number): number {
  return 1 / Math.log(attempts + 2);
}

/**
 * Time since last drilled, normalized across all cases.
 * Cases never attempted get score 1.0.
 */
function normalizedStaleness(
  c: PllRecognitionCaseWeight,
  all: PllRecognitionCaseWeight[],
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
  cases: PllRecognitionCaseWeight[],
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
