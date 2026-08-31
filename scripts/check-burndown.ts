import { computeBurndown, type BurndownInput } from "../src/lib/sprint/burndown";

const DAY = 86_400_000;
const START = new Date("2026-09-01T00:00:00.000Z");
const END = new Date("2026-09-05T00:00:00.000Z"); // 5-day box

function day(n: number, hour = 12): Date {
  return new Date(START.getTime() + n * DAY + hour * 3600_000);
}

let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = Object.is(actual, expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${actual}, want ${expected}`}`);
}

function base(over: Partial<BurndownInput> = {}): BurndownInput {
  return {
    startAt: START,
    endAt: END,
    committedPoints: 20,
    tasks: [],
    scopeChanges: [],
    ...over,
  };
}

// The time-box maps to one row per day, inclusive of both ends.
{
  const days = computeBurndown(base(), day(4));
  assertEqual(days.length, 5, "5-day box → 5 rows");
  assertEqual(days[0].date, "2026-09-01", "first row is the start day");
  assertEqual(days[4].date, "2026-09-05", "last row is the end day");
  // Values are end-of-day, so the ideal has already spent one of the four
  // working days in the box (Sep 5 is a Saturday) by the end of day 1.
  assertEqual(days[0].idealPoints, 15, "ideal line has spent one working day");
  assertEqual(days[4].idealPoints, 0, "ideal line ends at zero");
}

// Work finishing pulls the remaining line down; scope stays flat.
{
  const days = computeBurndown(
    base({
      tasks: [
        { points: 8, doneAt: day(1) },
        { points: 5, doneAt: day(3) },
        { points: 7, doneAt: null },
      ],
    }),
    day(4),
  );
  assertEqual(days[0].remainingPoints, 20, "nothing done on day 1");
  assertEqual(days[1].remainingPoints, 12, "8 points burned on day 2");
  assertEqual(days[3].remainingPoints, 7, "13 points burned by day 4");
  assertEqual(days[4].scopePoints, 20, "scope never moved");
  assertEqual(days[4].remainingCount, 1, "one card still open");
}

// Scope creep: work added after kick-off pushes the scope line UP.
{
  const days = computeBurndown(
    base({
      tasks: [
        { points: 20, doneAt: null },
        { points: 5, doneAt: null },
      ],
      scopeChanges: [{ action: "added", points: 5, changedAt: day(2) }],
    }),
    day(4),
  );
  assertEqual(days[1].scopePoints, 20, "scope unchanged before the addition");
  assertEqual(days[2].scopePoints, 25, "added work raises the scope line");
  assertEqual(days[2].remainingPoints, 25, "and raises what is left to do");
  assertEqual(days[1].scopeCount, 1, "card count at kick-off is reconstructed");
  assertEqual(days[2].scopeCount, 2, "and follows the log too");
}

// Trading work out is the honest way to add: scope comes back down.
{
  const days = computeBurndown(
    base({
      tasks: [{ points: 20, doneAt: null }],
      scopeChanges: [
        { action: "added", points: 5, changedAt: day(2) },
        { action: "removed", points: 5, changedAt: day(2) },
      ],
    }),
    day(4),
  );
  assertEqual(days[2].scopePoints, 20, "an even trade leaves scope flat");
}

// The plan does not burn down over a weekend.
{
  const days = computeBurndown(
    {
      startAt: new Date("2026-09-03T00:00:00.000Z"), // Thursday
      endAt: new Date("2026-09-08T00:00:00.000Z"), // the following Tuesday
      committedPoints: 12,
      tasks: [],
      scopeChanges: [],
    },
    new Date("2026-09-08T12:00:00.000Z"),
  );
  assertEqual(days.length, 6, "Thu→Tue is six calendar days");
  assertEqual(days[2].isWeekend, true, "Saturday is flagged");
  assertEqual(days[3].isWeekend, true, "Sunday is flagged");
  assertEqual(days[2].idealPoints, days[1].idealPoints, "the plan sits still on Saturday");
  assertEqual(days[3].idealPoints, days[1].idealPoints, "and on Sunday");
  assertEqual(days[4].idealPoints < days[3].idealPoints, true, "and resumes on Monday");
  assertEqual(days[5].idealPoints, 0, "reaching zero on the last working day");
}

// Days that have not happened yet are left blank, not drawn flat.
{
  const days = computeBurndown(
    base({ tasks: [{ points: 8, doneAt: day(0) }] }),
    day(1),
  );
  assertEqual(days[1].remainingPoints, 12, "today is drawn");
  assertEqual(days[2].remainingPoints, null, "tomorrow is not");
  assertEqual(days[2].scopePoints, 20, "but the scope line still extends");
}

// A sprint that never started has no commitment to burn down from.
{
  const days = computeBurndown(base({ committedPoints: null }), day(4));
  assertEqual(days[0].scopePoints, 0, "no commitment → nothing in scope");
  assertEqual(days[0].idealPoints, 0, "no commitment → flat ideal line");
}

// Finishing more than was committed cannot drive the line negative.
{
  const days = computeBurndown(
    base({
      committedPoints: 5,
      tasks: [{ points: 13, doneAt: day(0) }],
    }),
    day(4),
  );
  assertEqual(days[0].remainingPoints, 0, "remaining is clamped at zero");
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
