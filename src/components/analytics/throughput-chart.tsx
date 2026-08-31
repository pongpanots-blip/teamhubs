import { ChartCard } from "@/components/analytics/chart-card";
import { PLOT, axisMax, innerHeight, innerWidth, shortDate, yAt } from "@/components/analytics/plot";
import type { ThroughputWeek } from "@/lib/analytics/flow";

/** Cards finished per week. Empty weeks are drawn as gaps, not skipped. */
export function ThroughputChart({ weeks }: { weeks: ThroughputWeek[] }) {
  const max = axisMax(weeks.map((w) => w.count));
  const barWidth = weeks.length ? Math.min(28, (innerWidth / weeks.length) * 0.7) : 0;

  return (
    <ChartCard
      title="Throughput"
      description="Cards finished each week. A flat run is more useful than a fast one — it is what makes forecasting possible."
      empty={weeks.length === 0 ? "No finished cards to count yet." : undefined}
    >
      <line
        x1={PLOT.padLeft}
        y1={PLOT.padTop + innerHeight}
        x2={PLOT.padLeft + innerWidth}
        y2={PLOT.padTop + innerHeight}
        stroke="var(--border)"
      />
      {weeks.map((week, i) => {
        const center = PLOT.padLeft + ((i + 0.5) / weeks.length) * innerWidth;
        const y = yAt(week.count, max);
        return (
          <g key={week.weekStart}>
            <rect
              x={center - barWidth / 2}
              y={y}
              width={barWidth}
              height={PLOT.padTop + innerHeight - y}
              rx={2}
              fill="var(--st-done)"
              fillOpacity={0.75}
            >
              <title>{`Week of ${week.weekStart}: ${week.count} card(s)`}</title>
            </rect>
            {weeks.length <= 14 && (
              <text
                x={center}
                y={PLOT.height - 8}
                textAnchor="middle"
                className="text-[10px]"
                fill="var(--muted-foreground)"
              >
                {shortDate(week.weekStart)}
              </text>
            )}
          </g>
        );
      })}
    </ChartCard>
  );
}
