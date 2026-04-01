/**
 * Pure stat computation functions for PLL spam timer.
 */

/**
 * Returns the mean of the top `ceil(n * pct)` fastest times.
 *
 * Naturally scales with attempt count:
 * - < 20 attempts (at 5%): best single
 * - 40 attempts: average of best 2
 * - 100 attempts: average of best 5
 *
 * @param times - Array of execution times in milliseconds
 * @param pct - Top percentile fraction (default 0.05 = top 5%)
 * @returns Mean of the top-percentile fastest times, or NaN if times is empty
 */
export function topPercentMetric(times: number[], pct = 0.05): number {
  if (times.length === 0) return NaN;

  const sorted = [...times].sort((a, b) => a - b);
  const k = Math.ceil(sorted.length * pct);
  const topK = sorted.slice(0, k);

  return topK.reduce((sum, t) => sum + t, 0) / topK.length;
}

/**
 * Computes topPercentMetric at every `interval`-th attempt to produce
 * a time series for sparkline/trend visualization.
 *
 * Each data point is the top-percentile metric computed over all attempts
 * up to that point.
 *
 * @param times - Array of execution times in chronological order
 * @param pct - Top percentile fraction (default 0.05)
 * @param interval - Compute a data point every N attempts (default 5)
 * @returns Array of metric values at each interval point
 */
export function sparklineData(
  times: number[],
  pct = 0.05,
  interval = 5,
): number[] {
  const result: number[] = [];

  for (let i = interval; i <= times.length; i += interval) {
    result.push(topPercentMetric(times.slice(0, i), pct));
  }

  return result;
}
