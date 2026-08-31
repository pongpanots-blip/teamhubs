const DAY_MS = 86_400_000;

/**
 * The team's working calendar, as a fixed offset from UTC.
 *
 * A fixed offset rather than an IANA zone on purpose: it makes every duration
 * pure arithmetic with no DST edge cases, and the team this is built for keeps
 * one timezone that does not observe DST. A team that does would need a real
 * zone here — the offset would silently shift their weekend twice a year.
 */
export const BUSINESS_UTC_OFFSET_MINUTES = Number(
  process.env.BUSINESS_UTC_OFFSET_MINUTES ?? 420, // UTC+7, Asia/Bangkok
);

/**
 * Epoch day 0 (1970-01-01) was a Thursday, so day index mod 7 gives:
 * 0 Thu · 1 Fri · 2 Sat · 3 Sun · 4 Mon · 5 Tue · 6 Wed.
 */
function isWeekendDay(dayIndex: number): boolean {
  const weekday = ((dayIndex % 7) + 7) % 7;
  return weekday === 2 || weekday === 3;
}

export function isWeekend(
  date: Date,
  offsetMinutes: number = BUSINESS_UTC_OFFSET_MINUTES,
): boolean {
  return isWeekendDay(
    Math.floor((date.getTime() + offsetMinutes * 60_000) / DAY_MS),
  );
}

/**
 * Elapsed time between two instants with Saturdays and Sundays removed.
 *
 * Weekends are dropped whole — this is not a 9-to-5 clock. A card picked up on
 * Friday afternoon and finished Monday morning reads as a few hours rather than
 * three days, which is what the team would say happened. Nights still count:
 * cutting those too would need per-person hours the app does not have, and
 * would flatter the numbers rather than sharpen them.
 *
 * Returns 0 for a reversed or zero-length range, and for one that falls
 * entirely inside a weekend.
 */
export function businessMs(
  from: Date,
  to: Date,
  offsetMinutes: number = BUSINESS_UTC_OFFSET_MINUTES,
): number {
  const start = from.getTime() + offsetMinutes * 60_000;
  const end = to.getTime() + offsetMinutes * 60_000;
  if (end <= start) return 0;

  const firstDay = Math.floor(start / DAY_MS);
  const lastDay = Math.floor(end / DAY_MS);

  let total = 0;
  for (let day = firstDay; day <= lastDay; day++) {
    if (isWeekendDay(day)) continue;
    const dayStart = day * DAY_MS;
    total +=
      Math.min(end, dayStart + DAY_MS) - Math.max(start, dayStart);
  }
  return total;
}

/** Working days in [from, to], counting both ends. Used for the ideal burndown. */
export function businessDaysBetween(
  from: Date,
  to: Date,
  offsetMinutes: number = BUSINESS_UTC_OFFSET_MINUTES,
): number {
  const firstDay = Math.floor((from.getTime() + offsetMinutes * 60_000) / DAY_MS);
  const lastDay = Math.floor((to.getTime() + offsetMinutes * 60_000) / DAY_MS);

  let days = 0;
  for (let day = firstDay; day <= lastDay; day++) {
    if (!isWeekendDay(day)) days++;
  }
  return days;
}
