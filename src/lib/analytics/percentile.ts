/**
 * Nearest-rank percentile — the value at or below which `p` of the samples
 * fall. Deliberately not interpolated: a Service Level Expectation should
 * quote a duration a real card actually took, not one halfway between two.
 */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

export type ServiceLevel = {
  /** Cycle time (ms) that 50 / 85 / 95 % of finished cards came in under. */
  p50: number | null;
  p85: number | null;
  p95: number | null;
  /** How many finished cards the expectation is based on. */
  sampleSize: number;
};

/**
 * The team's own Service Level Expectation, read off its history rather than
 * promised in advance. Below ~10 finished cards the percentiles say more about
 * luck than about the team, so callers should show `sampleSize` alongside them.
 */
export function serviceLevel(cycleTimesMs: number[]): ServiceLevel {
  return {
    p50: percentile(cycleTimesMs, 50),
    p85: percentile(cycleTimesMs, 85),
    p95: percentile(cycleTimesMs, 95),
    sampleSize: cycleTimesMs.length,
  };
}
