import { ChartCard } from "@/components/analytics/chart-card";
import { PLOT, axisMax, innerHeight, shortDate, xAt, yAt } from "@/components/analytics/plot";
import { TASK_STATUSES, TASK_STATUS_COLUMN_LABEL } from "@/lib/task-constants";
import { taskStatusStyle } from "@/lib/task-status-style";
import type { CfdDay } from "@/lib/analytics/project-metrics";

/**
 * Stacked daily board census. A band that keeps widening is a queue building at
 * that column; the vertical distance between the top and the done band is
 * roughly the average cycle time.
 *
 * Stacked bottom-up in workflow order so the bands read the same way the board
 * does, left to right.
 */
export function CfdChart({ days }: { days: CfdDay[] }) {
  const totals = days.map((d) =>
    TASK_STATUSES.reduce((sum, s) => sum + d.counts[s], 0),
  );
  const max = axisMax(totals);
  const stackOrder = [...TASK_STATUSES].reverse();

  // Running total per day, so each band is drawn on top of the ones below it.
  const cumulative = days.map(() => 0);

  return (
    <ChartCard
      title="Cumulative flow"
      description="Where every card sat, day by day. A widening band is a queue forming at that column."
      empty={
        days.length < 2
          ? "Needs at least two daily snapshots — run `pnpm snapshot:flow` once a day."
          : undefined
      }
    >
      {stackOrder.map((status) => {
        const lower = [...cumulative];
        days.forEach((day, i) => {
          cumulative[i] += day.counts[status];
        });
        const upper = [...cumulative];
        const path = [
          ...upper.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i, days.length)},${yAt(v, max)}`),
          ...lower
            .map((v, i) => `L${xAt(i, days.length)},${yAt(v, max)}`)
            .reverse(),
          "Z",
        ].join(" ");
        return (
          <path key={status} d={path} fill={taskStatusStyle(status).color} fillOpacity={0.55}>
            <title>{TASK_STATUS_COLUMN_LABEL[status]}</title>
          </path>
        );
      })}
      <line
        x1={PLOT.padLeft}
        y1={PLOT.padTop + innerHeight}
        x2={xAt(days.length - 1, days.length)}
        y2={PLOT.padTop + innerHeight}
        stroke="var(--border)"
      />
      {days.length > 0 && (
        <>
          <text
            x={PLOT.padLeft}
            y={PLOT.height - 8}
            className="text-[10px]"
            fill="var(--muted-foreground)"
          >
            {shortDate(days[0].date)}
          </text>
          <text
            x={xAt(days.length - 1, days.length)}
            y={PLOT.height - 8}
            textAnchor="end"
            className="text-[10px]"
            fill="var(--muted-foreground)"
          >
            {shortDate(days[days.length - 1].date)}
          </text>
        </>
      )}
    </ChartCard>
  );
}
