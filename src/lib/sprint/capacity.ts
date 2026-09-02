import { ENGINEERING_ROLES, type TeamRoleValue } from "@/lib/task-constants";
import { businessDaysBetween } from "@/lib/business-time";

/** Working hours a UI/dev person is assumed to put in per business day. */
export const CAPACITY_HOURS_PER_DAY = 7;

/** Story points are treated 1:1 with working hours for capacity purposes. */
export const HOURS_PER_POINT = 1;

export type CapacityBreakdown = { ui: number; dev: number; total: number };

/**
 * Who counts toward story-point capacity: UI counted on its own, every other
 * engineering role folded into "dev". PMs never count — they don't carry
 * story-pointed work.
 */
export function capacityBreakdown(members: { role: string }[]): CapacityBreakdown {
  const ui = members.filter((m) => m.role === "ui").length;
  const dev = members.filter(
    (m) => m.role !== "ui" && (ENGINEERING_ROLES as TeamRoleValue[]).includes(m.role as TeamRoleValue),
  ).length;
  return { ui, dev, total: ui + dev };
}

/** Points a `headcount`-person team can carry per business day. */
export function dailyCapacityPoints(headcount: number): number {
  return (headcount * CAPACITY_HOURS_PER_DAY) / HOURS_PER_POINT;
}

/** A flat weekly rate (5 business days) — the number to show as "capacity per week". */
export function weeklyCapacityPoints(headcount: number): number {
  return dailyCapacityPoints(headcount) * 5;
}

/** Points available across an actual date range, counting only business days in it. */
export function capacityForRange(headcount: number, from: Date, to: Date): number {
  return dailyCapacityPoints(headcount) * businessDaysBetween(from, to);
}
