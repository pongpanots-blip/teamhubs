import {
  businessDaysBetween,
  businessMs,
  isWeekend,
} from "../src/lib/business-time";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Bangkok, matching the default BUSINESS_UTC_OFFSET_MINUTES. */
const BKK = 420;

let failures = 0;
function assertEqual(actual: unknown, expected: unknown, label: string) {
  const ok = Object.is(actual, expected);
  if (!ok) failures++;
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok ? "" : ` — got ${actual}, want ${expected}`}`);
}

// Weekday detection is in the team's timezone, not UTC. This is the case that
// makes the offset earn its keep: 20:00 UTC Friday is already Saturday morning
// in Bangkok, and must not count as work.
{
  assertEqual(isWeekend(new Date("2026-08-07T20:00:00Z"), BKK), true,
    "Fri 20:00 UTC is Saturday in Bangkok");
  assertEqual(isWeekend(new Date("2026-08-07T20:00:00Z"), 0), false,
    "the same instant is still Friday in UTC");
  assertEqual(isWeekend(new Date("2026-08-09T18:00:00Z"), BKK), false,
    "Sun 18:00 UTC is already Monday in Bangkok");
  assertEqual(isWeekend(new Date("2026-08-05T06:00:00Z"), BKK), false,
    "a plain Wednesday is not a weekend");
}

// Whole weekends drop out; nights do not.
{
  const friNoon = new Date("2026-08-07T05:00:00Z"); // Fri 12:00 Bangkok
  const monNoon = new Date("2026-08-10T05:00:00Z"); // Mon 12:00 Bangkok
  assertEqual(businessMs(friNoon, monNoon, BKK), 24 * HOUR,
    "Fri noon → Mon noon is one working day, not three");

  const wedNoon = new Date("2026-08-05T05:00:00Z");
  const thuNoon = new Date("2026-08-06T05:00:00Z");
  assertEqual(businessMs(wedNoon, thuNoon, BKK), 24 * HOUR,
    "a night inside the week still counts");
}

// Degenerate ranges return zero rather than something negative.
{
  const a = new Date("2026-08-05T05:00:00Z");
  const b = new Date("2026-08-06T05:00:00Z");
  assertEqual(businessMs(b, a, BKK), 0, "a reversed range is zero");
  assertEqual(businessMs(a, a, BKK), 0, "a zero-length range is zero");
  assertEqual(
    businessMs(new Date("2026-08-08T03:00:00Z"), new Date("2026-08-09T03:00:00Z"), BKK),
    0,
    "a span entirely inside the weekend is zero",
  );
}

// Partial days at each end are counted, not rounded.
{
  const satEvening = new Date("2026-08-08T14:00:00Z"); // Sat 21:00 Bangkok
  const monMorning = new Date("2026-08-10T02:00:00Z"); // Mon 09:00 Bangkok
  assertEqual(businessMs(satEvening, monMorning, BKK), 9 * HOUR,
    "only the Monday hours count when the range opens on a Saturday");
}

// Long spans stay exact — 4 weeks is 20 working days.
{
  const from = new Date("2026-08-03T00:00:00Z"); // Monday
  const to = new Date("2026-08-31T00:00:00Z"); // four weeks later, Monday
  assertEqual(businessMs(from, to, BKK), 20 * DAY, "four weeks is 20 working days");
}

// Working-day counts include both ends.
{
  assertEqual(
    businessDaysBetween(new Date("2026-08-03T00:00:00Z"), new Date("2026-08-07T00:00:00Z"), BKK),
    5,
    "Mon→Fri is five working days",
  );
  assertEqual(
    businessDaysBetween(new Date("2026-08-03T00:00:00Z"), new Date("2026-08-10T00:00:00Z"), BKK),
    6,
    "Mon→next Mon is six, the weekend removed",
  );
  assertEqual(
    businessDaysBetween(new Date("2026-08-08T00:00:00Z"), new Date("2026-08-09T00:00:00Z"), BKK),
    0,
    "a weekend on its own has no working days",
  );
}

console.log(failures === 0 ? "\nall checks passed" : `\n${failures} check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
