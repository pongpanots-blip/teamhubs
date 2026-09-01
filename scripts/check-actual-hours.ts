import {
  cappedWorkingHours,
  sessionHoursFromCommits,
  FIRST_COMMIT_CREDIT_MS,
  MAX_HOURS_PER_BUSINESS_DAY,
  SESSION_GAP_MS,
} from "../src/lib/tasks/actual-hours";

const HOUR = 3600_000;
const MINUTE = 60_000;
const T0 = new Date("2026-08-03T02:00:00.000Z");

function at(ms: number): Date {
  return new Date(T0.getTime() + ms);
}

let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = Object.is(actual, expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${actual}, want ${expected}`}`);
}

// The constants the rest of the cases assume.
{
  assertEqual(SESSION_GAP_MS, 2 * HOUR, "sessions split after a 2h gap");
  assertEqual(FIRST_COMMIT_CREDIT_MS, HOUR, "first commit of a session is worth 1h");
  assertEqual(MAX_HOURS_PER_BUSINESS_DAY, 8, "a card bills at most 8h/day");
}

// No commits is not zero hours of work — it is no evidence. The caller decides
// what to do with 0; this function just refuses to invent a span.
{
  assertEqual(sessionHoursFromCommits([]), 0, "no commits → 0");
}

// A lone commit has no span, so it is worth exactly the credit.
{
  assertEqual(sessionHoursFromCommits([at(0)]), 1, "one commit → the 1h credit");
}

// Span plus credit, inside one session.
{
  assertEqual(
    sessionHoursFromCommits([at(0), at(30 * MINUTE)]),
    1.5,
    "two commits 30min apart → 0.5h span + 1h credit",
  );
}

// A gap wider than the threshold starts a new sitting, so the credit is paid twice.
{
  assertEqual(
    sessionHoursFromCommits([at(0), at(5 * HOUR)]),
    2,
    "two commits 5h apart → two sessions → 2h",
  );
}

// Lunch is not a session boundary: 1h50m is inside the 2h threshold.
{
  assertEqual(
    sessionHoursFromCommits([at(0), at(110 * MINUTE), at(150 * MINUTE)]),
    3.5,
    "a 1h50m break stays one session",
  );
}

// Exactly at the threshold stays joined — the split is on `>`, not `>=`.
{
  assertEqual(
    sessionHoursFromCommits([at(0), at(2 * HOUR)]),
    3,
    "a gap of exactly 2h does not split",
  );
}

// Order of the input must not matter; commits arrive from the API newest-first.
{
  assertEqual(
    sessionHoursFromCommits([at(30 * MINUTE), at(0)]),
    1.5,
    "unsorted input gives the same answer",
  );
}

// The cap is the whole point of the fallback: elapsed time is not effort.
{
  assertEqual(cappedWorkingHours(40 * HOUR, 2), 16, "40h over 2 days caps at 16");
  assertEqual(cappedWorkingHours(3 * HOUR, 1), 3, "3h in a day is under the cap, so it stands");
  assertEqual(cappedWorkingHours(0, 3), 0, "no working time → 0");
  assertEqual(cappedWorkingHours(5 * HOUR, 0), 0, "no business days → 0");
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
