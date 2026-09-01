import { businessMs } from "@/lib/business-time";
import {
  STATUS_CATEGORY,
  TASK_STATUSES,
  isRework,
  type StatusCategoryValue,
  type TaskStatusValue,
} from "@/lib/task-constants";

/** The shape read from TaskStatusHistory — narrowed so this stays pure. */
export type HistoryEntry = {
  fromStatus: TaskStatusValue | null;
  toStatus: TaskStatusValue;
  changedAt: Date;
};

export type TaskMetrics = {
  /** Created → last entry into `done`. Null while the task is unfinished. */
  leadTimeMs: number | null;
  /** First entry into `working` → last entry into `done`. */
  cycleTimeMs: number | null;
  /** Total time spent in each status across the task's whole life. */
  timeInStatusMs: Record<TaskStatusValue, number>;
  /** Total time in `blocked`, over the whole life. */
  blockedTimeMs: number;
  /** Total idle time (blocked + review), over the whole life. */
  waitingTimeMs: number;
  /** Active time ÷ cycle time, 0–1. Null until the task has a cycle time. */
  flowEfficiency: number | null;
  /** How long the card has been in flight. Null once done, or before it starts. */
  wipAgeMs: number | null;
  /**
   * How long the card has sat in its *current* status — the open segment's
   * duration, not the lifetime total in timeInStatusMs. Drives the "stuck
   * in this column" indicator on the board. Null only when the task has no
   * history yet (a row that predates status tracking).
   */
  currentStatusMs: number | null;
  /** Times the card moved backwards through the workflow. */
  reworkCount: number;
};

type Segment = {
  status: TaskStatusValue;
  category: StatusCategoryValue;
  start: Date;
  end: Date;
};

/** Working-time overlap of a segment with [from, to], in ms. */
function overlapMs(segment: Segment, from: Date, to: Date): number {
  const start = Math.max(segment.start.getTime(), from.getTime());
  const end = Math.min(segment.end.getTime(), to.getTime());
  return end <= start ? 0 : businessMs(new Date(start), new Date(end));
}

/**
 * Derive every card-level flow metric from the transition log.
 *
 * Pure: `now` is injected so the same history always yields the same numbers.
 * Every duration is working time — weekends are removed (see businessMs), so a
 * card left over a Saturday does not read as two days of effort.
 */
export function computeTaskMetrics(
  input: { createdAt: Date; history: HistoryEntry[] },
  now: Date = new Date(),
): TaskMetrics {
  const history = [...input.history].sort(
    (a, b) => a.changedAt.getTime() - b.changedAt.getTime(),
  );

  const timeInStatusMs = Object.fromEntries(
    TASK_STATUSES.map((s) => [s, 0]),
  ) as Record<TaskStatusValue, number>;

  if (history.length === 0) {
    return {
      leadTimeMs: null,
      cycleTimeMs: null,
      timeInStatusMs,
      blockedTimeMs: 0,
      waitingTimeMs: 0,
      flowEfficiency: null,
      wipAgeMs: null,
      currentStatusMs: null,
      reworkCount: 0,
    };
  }

  // Each entry's status runs until the next entry — the open one runs to `now`.
  const segments: Segment[] = history.map((entry, i) => ({
    status: entry.toStatus,
    category: STATUS_CATEGORY[entry.toStatus],
    start: entry.changedAt,
    end: history[i + 1]?.changedAt ?? now,
  }));

  for (const segment of segments) {
    timeInStatusMs[segment.status] += businessMs(segment.start, segment.end);
  }

  const current = history[history.length - 1].toStatus;
  const isDone = STATUS_CATEGORY[current] === "done";

  const firstActiveAt =
    history.find((e) => STATUS_CATEGORY[e.toStatus] === "active")?.changedAt ??
    null;
  // The last transition into done — a reopened-then-finished card is measured
  // to the finish that stuck, not the first one.
  const doneAt = isDone ? history[history.length - 1].changedAt : null;

  // Zero rather than null when the whole span fell on a weekend: no working
  // time passed, which is a different statement from "never finished".
  const cycleTimeMs =
    firstActiveAt && doneAt && doneAt > firstActiveAt
      ? businessMs(firstActiveAt, doneAt)
      : null;

  const activeMsInCycle =
    firstActiveAt && doneAt
      ? segments
          .filter((s) => s.category === "active")
          .reduce((sum, s) => sum + overlapMs(s, firstActiveAt, doneAt), 0)
      : 0;

  return {
    leadTimeMs: doneAt ? businessMs(input.createdAt, doneAt) : null,
    cycleTimeMs,
    timeInStatusMs,
    blockedTimeMs: timeInStatusMs.blocked,
    waitingTimeMs: timeInStatusMs.blocked + timeInStatusMs.review,
    flowEfficiency: cycleTimeMs ? activeMsInCycle / cycleTimeMs : null,
    wipAgeMs: !isDone && firstActiveAt ? businessMs(firstActiveAt, now) : null,
    currentStatusMs: businessMs(segments[segments.length - 1].start, now),
    reworkCount: history.filter(
      (e) => e.fromStatus && isRework(e.fromStatus, e.toStatus),
    ).length,
  };
}
