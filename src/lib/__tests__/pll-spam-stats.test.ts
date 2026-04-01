import { describe, it, expect } from "vitest";
import { topPercentMetric, sparklineData } from "../pll-spam-stats";

describe("topPercentMetric", () => {
  it("returns NaN for empty array", () => {
    expect(topPercentMetric([])).toBeNaN();
  });

  it("returns the single value for a one-element array", () => {
    expect(topPercentMetric([500])).toBe(500);
  });

  it("returns best single when < 20 attempts at 5%", () => {
    // 10 attempts → ceil(10 * 0.05) = 1 → best single
    const times = [800, 600, 900, 500, 700, 1000, 550, 650, 750, 850];
    expect(topPercentMetric(times)).toBe(500);
  });

  it("returns average of best 2 for 40 attempts at 5%", () => {
    // 40 attempts → ceil(40 * 0.05) = 2
    const times = Array.from({ length: 40 }, (_, i) => 1000 + i * 10);
    // Sorted: 1000, 1010, 1020, ...
    // Best 2: 1000, 1010 → mean = 1005
    expect(topPercentMetric(times)).toBe(1005);
  });

  it("returns average of best 5 for 100 attempts at 5%", () => {
    // 100 attempts → ceil(100 * 0.05) = 5
    const times = Array.from({ length: 100 }, (_, i) => 500 + i * 5);
    // Sorted ascending: 500, 505, 510, 515, 520, ...
    // Best 5: 500, 505, 510, 515, 520 → mean = 510
    expect(topPercentMetric(times)).toBe(510);
  });

  it("works with custom percentile", () => {
    // 10 items at 50% → ceil(10 * 0.5) = 5
    const times = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    expect(topPercentMetric(times, 0.5)).toBe(30); // mean of 10,20,30,40,50
  });

  it("does not mutate the input array", () => {
    const times = [300, 100, 200];
    const copy = [...times];
    topPercentMetric(times);
    expect(times).toEqual(copy);
  });

  it("handles duplicate values", () => {
    const times = [500, 500, 500, 500, 500];
    expect(topPercentMetric(times)).toBe(500);
  });

  it("ceil rounds up correctly at boundary", () => {
    // 19 attempts at 5% → ceil(0.95) = 1 → best single
    const times = Array.from({ length: 19 }, (_, i) => 100 + i);
    expect(topPercentMetric(times)).toBe(100);

    // 20 attempts at 5% → ceil(1.0) = 1 → still best single
    const times20 = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(topPercentMetric(times20)).toBe(100);

    // 21 attempts at 5% → ceil(1.05) = 2 → average of best 2
    const times21 = Array.from({ length: 21 }, (_, i) => 100 + i);
    expect(topPercentMetric(times21)).toBe(100.5); // (100 + 101) / 2
  });
});

describe("sparklineData", () => {
  it("returns empty array for empty input", () => {
    expect(sparklineData([])).toEqual([]);
  });

  it("returns empty array when fewer than interval attempts", () => {
    expect(sparklineData([100, 200, 300])).toEqual([]);
  });

  it("produces one data point per interval", () => {
    // 15 attempts, interval=5 → 3 data points
    const times = Array.from({ length: 15 }, () => 500);
    const result = sparklineData(times);
    expect(result).toHaveLength(3);
  });

  it("computes cumulative metric at each interval", () => {
    // 10 attempts with interval=5
    // First 5: [100, 200, 300, 400, 500] → best single = 100
    // First 10: [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000] → best single = 100
    const times = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
    const result = sparklineData(times);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(100); // topPercentMetric of first 5
    expect(result[1]).toBe(100); // topPercentMetric of first 10
  });

  it("shows improvement trend when later times are faster", () => {
    // First 5 are slow, next 5 are fast
    const times = [1000, 1100, 1200, 1300, 1400, 200, 210, 220, 230, 240];
    const result = sparklineData(times);
    expect(result).toHaveLength(2);
    // First 5: best single = 1000
    expect(result[0]).toBe(1000);
    // First 10: best single = 200
    expect(result[1]).toBe(200);
  });

  it("drops trailing attempts that don't complete an interval", () => {
    // 7 attempts, interval=5 → only 1 data point (at index 5)
    const times = [100, 200, 300, 400, 500, 600, 700];
    const result = sparklineData(times);
    expect(result).toHaveLength(1);
  });

  it("respects custom interval", () => {
    const times = Array.from({ length: 9 }, () => 500);
    // interval=3 → 3 data points (at 3, 6, 9)
    expect(sparklineData(times, 0.05, 3)).toHaveLength(3);
  });

  it("respects custom percentile", () => {
    // 10 items, pct=0.5, interval=5
    // First 5: [10, 20, 30, 40, 50] at 50% → ceil(2.5)=3 → mean(10,20,30) = 20
    // First 10: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100] at 50% → ceil(5)=5 → mean(10,20,30,40,50) = 30
    const times = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = sparklineData(times, 0.5, 5);
    expect(result).toEqual([20, 30]);
  });
});
