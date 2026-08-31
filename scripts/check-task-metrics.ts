import {
  computeTaskMetrics,
  type HistoryEntry,
} from "../src/lib/tasks/metrics";
import { isRework, STATUS_CATEGORY } from "../src/lib/task-constants";
import type { TaskStatusValue } from "../src/lib/task-constants";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
// A Monday, 09:00 Bangkok (the default business offset) — so plain hour maths
// in these cases stays inside the working week unless a case says otherwise.
const T0 = new Date("2026-08-03T02:00:00.000Z");

function at(hours: number): Date {
  return new Date(T0.getTime() + hours * HOUR);
}

function entry(hours: number, to: TaskStatusValue, from: TaskStatusValue | null): HistoryEntry {
  return { fromStatus: from, toStatus: to, changedAt: at(hours) };
}

let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = Object.is(actual, expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${actual}, want ${expected}`}`);
}

// A card with no history at all reports nothing rather than zeroes that read
// as "instant delivery".
{
  const m = computeTaskMetrics({ createdAt: T0, history: [] }, at(10));
  assertEqual(m.cycleTimeMs, null, "empty history → no cycle time");
  assertEqual(m.leadTimeMs, null, "empty history → no lead time");
  assertEqual(m.wipAgeMs, null, "empty history → no WIP age");
  assertEqual(m.reworkCount, 0, "empty history → no rework");
}

// Straight run: created → assigned → working → review → done.
// Cycle starts at `working`, NOT at `assigned`.
{
  const m = computeTaskMetrics(
    {
      createdAt: T0,
      history: [
        entry(0, "not_ready", null),
        entry(24, "assigned", "not_ready"),
        entry(48, "working", "assigned"),
        entry(56, "review", "working"),
        entry(72, "done", "review"),
      ],
    },
    at(100),
  );
  assertEqual(m.cycleTimeMs, 24 * HOUR, "cycle time runs working→done");
  assertEqual(m.leadTimeMs, 72 * HOUR, "lead time runs createdAt→done");
  assertEqual(m.timeInStatusMs.assigned, 24 * HOUR, "time in assigned");
  assertEqual(m.timeInStatusMs.review, 16 * HOUR, "time in review");
  assertEqual(m.waitingTimeMs, 16 * HOUR, "review counts as waiting");
  assertEqual(m.flowEfficiency, 8 / 24, "flow efficiency = active ÷ cycle");
  assertEqual(m.wipAgeMs, null, "finished card has no WIP age");
  assertEqual(m.reworkCount, 0, "forward-only run has no rework");
}

// Blocked mid-work is an interruption, not a step backwards.
{
  const m = computeTaskMetrics(
    {
      createdAt: T0,
      history: [
        entry(0, "working", null),
        entry(4, "blocked", "working"),
        entry(28, "working", "blocked"),
        entry(32, "done", "working"),
      ],
    },
    at(40),
  );
  assertEqual(m.blockedTimeMs, 24 * HOUR, "blocked time summed");
  assertEqual(m.reworkCount, 0, "working↔blocked is not rework");
  assertEqual(m.flowEfficiency, 8 / 32, "blocked time drags efficiency down");
}

// Bounced back from review — the classic rework signal.
{
  const m = computeTaskMetrics(
    {
      createdAt: T0,
      history: [
        entry(0, "working", null),
        entry(8, "review", "working"),
        entry(16, "working", "review"),
        entry(24, "review", "working"),
        entry(32, "done", "review"),
      ],
    },
    at(40),
  );
  assertEqual(m.reworkCount, 1, "review→working counts once");
  assertEqual(m.cycleTimeMs, 32 * HOUR, "cycle spans the whole bounce");
}

// Reopened after done: measured to the finish that stuck.
{
  const m = computeTaskMetrics(
    {
      createdAt: T0,
      history: [
        entry(0, "working", null),
        entry(8, "done", "working"),
        entry(48, "working", "done"),
        entry(56, "done", "working"),
      ],
    },
    at(60),
  );
  assertEqual(m.reworkCount, 1, "done→working counts as rework");
  assertEqual(m.leadTimeMs, 56 * HOUR, "lead time measured to the last done");
  assertEqual(m.wipAgeMs, null, "reopened-then-finished is not in flight");
}

// In flight right now: WIP age is what warns before the card is late.
{
  const m = computeTaskMetrics(
    {
      createdAt: T0,
      history: [entry(0, "assigned", null), entry(24, "working", "assigned")],
    },
    at(24 + 7 * 24),
  );
  assertEqual(m.wipAgeMs, 5 * DAY, "WIP age counts working days only (7 calendar → 5)");
  assertEqual(m.cycleTimeMs, null, "unfinished card has no cycle time");
  assertEqual(m.flowEfficiency, null, "no cycle time → no flow efficiency");
}

// Weekends are not effort. A card picked up Friday afternoon and finished
// Monday morning took hours, not three days.
{
  const friday3pm = new Date("2026-08-07T08:00:00.000Z"); // Fri 15:00 Bangkok
  const mondayNoon = new Date("2026-08-10T05:00:00.000Z"); // Mon 12:00 Bangkok
  const m = computeTaskMetrics(
    {
      createdAt: friday3pm,
      history: [
        { fromStatus: null, toStatus: "working", changedAt: friday3pm },
        { fromStatus: "working", toStatus: "done", changedAt: mondayNoon },
      ],
    },
    mondayNoon,
  );
  // 15:00 Fri → midnight = 9h, plus midnight → 12:00 Mon = 12h.
  assertEqual(m.cycleTimeMs, 21 * HOUR, "the weekend is dropped from cycle time");
  assertEqual(m.leadTimeMs, 21 * HOUR, "and from lead time");
}

// A card that only ever sat over a weekend did no working time — which is not
// the same statement as "never finished".
{
  const saturday = new Date("2026-08-08T03:00:00.000Z"); // Sat 10:00 Bangkok
  const sunday = new Date("2026-08-09T03:00:00.000Z"); // Sun 10:00 Bangkok
  const m = computeTaskMetrics(
    {
      createdAt: saturday,
      history: [
        { fromStatus: null, toStatus: "working", changedAt: saturday },
        { fromStatus: "working", toStatus: "done", changedAt: sunday },
      ],
    },
    sunday,
  );
  assertEqual(m.cycleTimeMs, 0, "a weekend-only span is zero working time");
  assertEqual(m.flowEfficiency, null, "and yields no flow efficiency to divide");
}

// Category + rank mapping — the assumptions every metric above rests on.
{
  assertEqual(STATUS_CATEGORY.assigned, "backlog", "assigned is not active work");
  assertEqual(STATUS_CATEGORY.working, "active", "working is active");
  assertEqual(STATUS_CATEGORY.blocked, "waiting", "blocked is waiting");
  assertEqual(STATUS_CATEGORY.review, "waiting", "review is waiting");
  assertEqual(isRework("review", "working"), true, "review→working is rework");
  assertEqual(isRework("working", "blocked"), false, "working→blocked is not rework");
  assertEqual(isRework("ready", "working"), false, "forward move is not rework");
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
