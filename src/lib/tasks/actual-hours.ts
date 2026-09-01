/**
 * Turning evidence of work into a number of hours.
 *
 * Both functions here are guesses, and deliberately conservative ones. A commit
 * timestamp says when someone saved, not how long they sat there; a status
 * transition says when a card moved, not who was at the keyboard. Nothing in
 * either source can be read as fact, so the arithmetic stays simple enough that
 * a reader can see exactly which assumption produced a surprising number.
 *
 * Pure on purpose — no DB, no network — so `scripts/check-actual-hours.ts` can
 * pin the behaviour without a database.
 */

const HOUR_MS = 3_600_000;

/** Commits closer together than this are treated as one sitting. */
export const SESSION_GAP_MS = 2 * HOUR_MS;

/**
 * Credited to the first commit of every session. That commit has no predecessor
 * to measure back from, and the work leading up to it is exactly the work the
 * span would otherwise miss. One hour is a guess; it is the one knob most worth
 * revisiting if the numbers read low.
 */
export const FIRST_COMMIT_CREDIT_MS = HOUR_MS;

/** Nobody bills a card more than this in a day, however long it sat open. */
export const MAX_HOURS_PER_BUSINESS_DAY = 8;

/** Halves, matching the granularity the field allowed when it was typed by hand. */
function roundHalf(hours: number): number {
  return Math.round(hours * 2) / 2;
}

/**
 * Group commits into sittings and sum them.
 *
 * A lone commit is worth the credit and nothing else — there is no span to
 * measure, and reporting zero for a card that demonstrably had work done on it
 * would be worse than reporting a rough hour.
 */
export function sessionHoursFromCommits(times: Date[]): number {
  if (times.length === 0) return 0;

  const sorted = [...times]
    .map((d) => d.getTime())
    .filter((t) => Number.isFinite(t))
    .sort((a, b) => a - b);
  if (sorted.length === 0) return 0;

  let total = 0;
  let sessionStart = sorted[0];
  let previous = sorted[0];

  for (const time of sorted.slice(1)) {
    if (time - previous > SESSION_GAP_MS) {
      total += previous - sessionStart + FIRST_COMMIT_CREDIT_MS;
      sessionStart = time;
    }
    previous = time;
  }
  total += previous - sessionStart + FIRST_COMMIT_CREDIT_MS;

  return roundHalf(total / HOUR_MS);
}

/**
 * The fallback for cards with no commits: time spent in `working`, capped.
 *
 * The cap is doing the real work here. `businessMs` — which produces
 * `workingMs` — drops weekends but keeps nights (see business-time.ts), so a
 * card left open across two nights arrives here as ~48h. Capping at eight hours
 * per business day spanned turns elapsed time back into something that can be
 * read as effort.
 */
export function cappedWorkingHours(workingMs: number, businessDays: number): number {
  if (workingMs <= 0 || businessDays <= 0) return 0;
  const elapsed = workingMs / HOUR_MS;
  return roundHalf(Math.min(elapsed, businessDays * MAX_HOURS_PER_BUSINESS_DAY));
}
