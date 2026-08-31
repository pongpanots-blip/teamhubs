import { businessDaysBetween, isWeekend } from "@/lib/business-time";

export type BurndownTask = {
  points: number;
  /** When the card last entered `done`. Null while unfinished. */
  doneAt: Date | null;
};

export type BurndownScopeChange = {
  action: "added" | "removed";
  points: number;
  changedAt: Date;
};

export type BurndownDay = {
  /** YYYY-MM-DD (UTC). */
  date: string;
  /** Total points in scope at end of day — rises when work is added mid-sprint. */
  scopePoints: number;
  /** Scope minus finished work. Null for days that have not happened yet. */
  remainingPoints: number | null;
  /** Straight line from the commitment down to zero, for comparison only.
   *  Flat across weekends — a plan that burns down on a Sunday is not a plan. */
  idealPoints: number;
  /** True on Saturdays and Sundays, so the chart can mark them. */
  isWeekend: boolean;
  /** Same two lines by card count, for teams that right-size instead of estimating. */
  scopeCount: number;
  remainingCount: number | null;
};

export type BurndownInput = {
  startAt: Date;
  endAt: Date;
  /** Frozen at kick-off. Null while the sprint has not started. */
  committedPoints: number | null;
  /** Cards currently in the sprint. Cards that were removed are not here. */
  tasks: BurndownTask[];
  scopeChanges: BurndownScopeChange[];
};

function endOfUtcDay(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(23, 59, 59, 999);
  return d;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function signed(change: BurndownScopeChange): number {
  return change.action === "added" ? 1 : -1;
}

/**
 * Daily burndown across the sprint's time-box.
 *
 * The scope line is rebuilt from the frozen commitment plus the scope-change
 * log — never from today's estimates — so re-estimating a card mid-sprint
 * cannot quietly redraw history, and work added after kick-off shows up as the
 * line going *up*. Days after `now` are left null rather than drawn flat.
 *
 * Pure: `now` is injected, and all day boundaries are UTC.
 */
export function computeBurndown(
  input: BurndownInput,
  now: Date = new Date(),
): BurndownDay[] {
  const committedPoints = input.committedPoints ?? 0;

  // The card count at kick-off is reconstructed from the log rather than
  // frozen: unlike points, a count cannot be changed by a re-estimate.
  const committedCount =
    input.tasks.length -
    input.scopeChanges.reduce((sum, c) => sum + signed(c), 0);

  const days: BurndownDay[] = [];
  const totalDays =
    Math.floor(
      (endOfUtcDay(input.endAt).getTime() - endOfUtcDay(input.startAt).getTime()) /
        86_400_000,
    ) + 1;

  const workingDays = businessDaysBetween(input.startAt, input.endAt);
  let workingDaysElapsed = 0;

  for (let i = 0; i < totalDays; i++) {
    const dayStart = new Date(input.startAt.getTime() + i * 86_400_000);
    const weekend = isWeekend(dayStart);
    if (!weekend) workingDaysElapsed++;
    const cursor = endOfUtcDay(dayStart);
    const upTo = (d: Date) => d.getTime() <= cursor.getTime();

    const applied = input.scopeChanges.filter((c) => upTo(c.changedAt));
    const scopePoints =
      committedPoints + applied.reduce((s, c) => s + signed(c) * c.points, 0);
    const scopeCount =
      committedCount + applied.reduce((s, c) => s + signed(c), 0);

    const finished = input.tasks.filter((t) => t.doneAt && upTo(t.doneAt));
    // A day counts as future only once it has not begun — the day in progress
    // is drawn from what has happened so far, not left blank until midnight.
    const isFuture = dayStart.getTime() > now.getTime();

    days.push({
      date: isoDate(cursor),
      scopePoints,
      scopeCount,
      remainingPoints: isFuture
        ? null
        : Math.max(0, scopePoints - finished.reduce((s, t) => s + t.points, 0)),
      remainingCount: isFuture ? null : Math.max(0, scopeCount - finished.length),
      isWeekend: weekend,
      // Spent against working days, not calendar days: the line should sit
      // still over a weekend rather than accusing the team of falling behind.
      idealPoints:
        workingDays > 0
          ? committedPoints * (1 - workingDaysElapsed / workingDays)
          : 0,
    });
  }

  return days;
}
