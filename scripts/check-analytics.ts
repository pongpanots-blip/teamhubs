import { percentile, serviceLevel } from "../src/lib/analytics/percentile";
import {
  agingWip,
  throughputByWeek,
  weekStartUtc,
  type CardFlow,
} from "../src/lib/analytics/flow";

const DAY = 86_400_000;

let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = Object.is(actual, expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${actual}, want ${expected}`}`);
}

function card(over: Partial<CardFlow>): CardFlow {
  return {
    taskId: "t",
    title: "Card",
    status: "done",
    cycleTimeMs: null,
    doneAt: null,
    wipAgeMs: null,
    ...over,
  };
}

// Nearest-rank: every percentile is a value a real card actually hit.
{
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assertEqual(percentile(values, 50), 5, "p50 of 1..10");
  assertEqual(percentile(values, 85), 9, "p85 of 1..10");
  assertEqual(percentile(values, 95), 10, "p95 of 1..10");
  assertEqual(percentile(values, 100), 10, "p100 is the max");
  assertEqual(percentile([], 85), null, "no samples → no percentile");
  assertEqual(percentile([7], 85), 7, "single sample");
  assertEqual(percentile([5, 1, 3], 50), 3, "input order does not matter");
}

// The SLE reports its own sample size, so a number built on 3 cards is not
// mistaken for a promise.
{
  const sle = serviceLevel([2 * DAY, 6 * DAY, 4 * DAY]);
  assertEqual(sle.p50, 4 * DAY, "SLE p50");
  assertEqual(sle.sampleSize, 3, "SLE carries its sample size");
  assertEqual(serviceLevel([]).p85, null, "empty history → no SLE");
}

// Weeks start Monday UTC, and Sunday belongs to the week that already began.
{
  assertEqual(weekStartUtc(new Date("2026-09-02T12:00:00Z")).toISOString().slice(0, 10),
    "2026-08-31", "Wednesday maps back to Monday");
  assertEqual(weekStartUtc(new Date("2026-08-31T00:00:00Z")).toISOString().slice(0, 10),
    "2026-08-31", "Monday maps to itself");
  assertEqual(weekStartUtc(new Date("2026-09-06T23:00:00Z")).toISOString().slice(0, 10),
    "2026-08-31", "Sunday belongs to the week that began Monday");
}

// A week where nothing shipped is still a row — that stall is the signal.
{
  const weeks = throughputByWeek(
    [
      card({ doneAt: new Date("2026-08-31T10:00:00Z") }),
      card({ doneAt: new Date("2026-09-02T10:00:00Z") }),
      card({ doneAt: new Date("2026-09-14T10:00:00Z") }),
    ],
    { from: new Date("2026-08-31T00:00:00Z"), to: new Date("2026-09-14T00:00:00Z") },
  );
  assertEqual(weeks.length, 3, "three weeks in range");
  assertEqual(weeks[0].count, 2, "two cards shipped in week 1");
  assertEqual(weeks[1].count, 0, "the empty week is kept");
  assertEqual(weeks[2].count, 1, "one card in week 3");
}

// Aging WIP: oldest first, flagged against the team's own p85.
{
  const aging = agingWip(
    [
      card({ taskId: "young", status: "working", wipAgeMs: 2 * DAY }),
      card({ taskId: "old", status: "review", wipAgeMs: 9 * DAY }),
      card({ taskId: "finished", status: "done", wipAgeMs: null }),
    ],
    6 * DAY,
  );
  assertEqual(aging.length, 2, "finished cards are not aging");
  assertEqual(aging[0].taskId, "old", "oldest card first");
  assertEqual(aging[0].breachesSle, true, "9 days breaches a 6-day SLE");
  assertEqual(aging[1].breachesSle, false, "2 days does not");
}

// With no SLE yet, nothing is flagged — an invented threshold would be noise.
{
  const aging = agingWip([card({ status: "working", wipAgeMs: 30 * DAY })], null);
  assertEqual(aging[0].breachesSle, false, "no SLE → no false alarm");
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
