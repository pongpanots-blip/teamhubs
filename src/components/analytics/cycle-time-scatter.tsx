import { ChartCard } from "@/components/analytics/chart-card";
import { PLOT, axisMax, innerHeight, innerWidth, yAt } from "@/components/analytics/plot";
import type { ServiceLevel } from "@/lib/analytics/percentile";
import { formatDuration } from "@/lib/analytics/format";

export type ScatterPoint = { taskId: string; title: string; doneAt: string; cycleTimeMs: number };

const PERCENTILE_LINES = [
  { key: "p50" as const, label: "50%", color: "var(--st-review)" },
  { key: "p85" as const, label: "85%", color: "var(--st-blocked)" },
  { key: "p95" as const, label: "95%", color: "var(--st-not_ready)" },
];

/**
 * One dot per finished card, with the team's percentile lines across it.
 * The spread is the point: an average hides the two-week outlier that a
 * scatter plot puts right in front of you.
 */
export function CycleTimeScatter({
  points,
  sle,
  windowDays,
  from,
  to,
}: {
  points: ScatterPoint[];
  sle: ServiceLevel;
  windowDays: number;
  /** Window bounds as ISO strings — passed in so the chart itself stays pure. */
  from: string;
  to: string;
}) {
  const fromMs = new Date(from).getTime();
  const spanMs = Math.max(1, new Date(to).getTime() - fromMs);
  const max = axisMax([
    ...points.map((p) => p.cycleTimeMs),
    ...PERCENTILE_LINES.map((l) => sle[l.key] ?? 0),
  ]);

  const xForDate = (iso: string) => {
    const ratio = (new Date(iso).getTime() - fromMs) / spanMs;
    return PLOT.padLeft + Math.min(1, Math.max(0, ratio)) * innerWidth;
  };

  return (
    <ChartCard
      title="Cycle time"
      description={`Each dot is a finished card. Lines are the ${sle.sampleSize}-card service level — 85% came in under ${formatDuration(sle.p85)}.`}
      empty={points.length === 0 ? "No cards finished in this window yet." : undefined}
    >
      <line
        x1={PLOT.padLeft}
        y1={PLOT.padTop + innerHeight}
        x2={PLOT.padLeft + innerWidth}
        y2={PLOT.padTop + innerHeight}
        stroke="var(--border)"
      />
      {PERCENTILE_LINES.map((line) => {
        const value = sle[line.key];
        if (value === null) return null;
        const y = yAt(value, max);
        return (
          <g key={line.key}>
            <line
              x1={PLOT.padLeft}
              y1={y}
              x2={PLOT.padLeft + innerWidth}
              y2={y}
              stroke={line.color}
              strokeDasharray="4 4"
              strokeWidth={1}
            />
            <text x={4} y={y + 4} className="text-[10px]" fill="var(--muted-foreground)">
              {line.label}
            </text>
          </g>
        );
      })}
      {points.map((point) => (
        <circle
          key={point.taskId}
          cx={xForDate(point.doneAt)}
          cy={yAt(point.cycleTimeMs, max)}
          r={4}
          fill="var(--st-done)"
          fillOpacity={0.65}
        >
          <title>{`${point.title} — ${formatDuration(point.cycleTimeMs)}`}</title>
        </circle>
      ))}
      <text
        x={PLOT.padLeft}
        y={PLOT.height - 8}
        className="text-[10px]"
        fill="var(--muted-foreground)"
      >
        {`${windowDays} days ago`}
      </text>
      <text
        x={PLOT.padLeft + innerWidth}
        y={PLOT.height - 8}
        textAnchor="end"
        className="text-[10px]"
        fill="var(--muted-foreground)"
      >
        today
      </text>
    </ChartCard>
  );
}
