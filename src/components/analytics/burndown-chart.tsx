import { ChartCard } from "@/components/analytics/chart-card";
import { PLOT, axisMax, innerHeight, shortDate, xAt, yAt } from "@/components/analytics/plot";
import type { BurndownDay } from "@/lib/sprint/burndown";

function line(values: (number | null)[], max: number, count: number): string {
  return values
    .map((v, i) => (v === null ? null : `${xAt(i, count)},${yAt(v, max)}`))
    .filter((p): p is string => p !== null)
    .map((p, i) => `${i === 0 ? "M" : "L"}${p}`)
    .join(" ");
}

/**
 * Remaining work against the plan, with the scope line drawn separately.
 * Those two lines are the whole point: without the scope line, work added
 * mid-sprint just looks like the team going slower.
 */
export function BurndownChart({
  days,
  sprintName,
}: {
  days: BurndownDay[];
  sprintName: string;
}) {
  const max = axisMax([
    ...days.map((d) => d.scopePoints),
    ...days.map((d) => d.remainingPoints ?? 0),
  ]);

  return (
    <ChartCard
      title={`Burndown — ${sprintName}`}
      description="Solid is work left, dashed is the plan, and the grey line is total scope. Grey rising means work was added after kick-off; shaded columns are weekends, where the plan sits still."
      empty={days.length === 0 ? "This sprint has no time-box to plot." : undefined}
    >
      {days.map((day, i) =>
        day.isWeekend ? (
          <rect
            key={day.date}
            x={xAt(i, days.length) - 4}
            y={PLOT.padTop}
            width={8}
            height={innerHeight}
            fill="var(--muted)"
            fillOpacity={0.7}
          />
        ) : null,
      )}
      <line
        x1={PLOT.padLeft}
        y1={PLOT.padTop + innerHeight}
        x2={xAt(days.length - 1, days.length)}
        y2={PLOT.padTop + innerHeight}
        stroke="var(--border)"
      />
      <path
        d={line(days.map((d) => d.scopePoints), max, days.length)}
        fill="none"
        stroke="var(--muted-foreground)"
        strokeWidth={1.5}
        strokeOpacity={0.5}
      />
      <path
        d={line(days.map((d) => d.idealPoints), max, days.length)}
        fill="none"
        stroke="var(--border)"
        strokeWidth={1.5}
        strokeDasharray="5 4"
      />
      <path
        d={line(days.map((d) => d.remainingPoints), max, days.length)}
        fill="none"
        stroke="var(--st-working)"
        strokeWidth={2.5}
      />
      {days.length > 0 && (
        <>
          <text x={PLOT.padLeft} y={PLOT.height - 8} className="text-[10px]" fill="var(--muted-foreground)">
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
