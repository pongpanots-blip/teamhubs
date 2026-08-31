const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/**
 * Durations as a team says them out loud: "3d 4h", "5h", "40m". Rounded down,
 * two units at most — a flow metric precise to the second implies an accuracy
 * the underlying wall-clock timing does not have.
 */
export function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 60_000) return "<1m";
  if (ms < HOUR) return `${Math.floor(ms / 60_000)}m`;
  if (ms < DAY) {
    const hours = Math.floor(ms / HOUR);
    const minutes = Math.floor((ms % HOUR) / 60_000);
    return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
  }
  const days = Math.floor(ms / DAY);
  const hours = Math.floor((ms % DAY) / HOUR);
  return hours ? `${days}d ${hours}h` : `${days}d`;
}

export function formatPercent(ratio: number | null): string {
  return ratio === null ? "—" : `${Math.round(ratio * 100)}%`;
}
