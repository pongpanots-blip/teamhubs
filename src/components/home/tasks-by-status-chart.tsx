import { ChartCard } from "@/components/analytics/chart-card";
import { PLOT, axisMax, innerHeight, innerWidth, yAt } from "@/components/analytics/plot";
import { TASK_STATUSES, TASK_STATUS_COLUMN_LABEL, type TaskStatusValue } from "@/lib/task-constants";
import { taskStatusStyle } from "@/lib/task-status-style";

/**
 * Where every open (and done) card on this project sits right now — a single
 * snapshot, not a trend. The per-project analytics page already covers change
 * over time (CFD, throughput); this is just "what does today look like".
 */
export function TasksByStatusChart({ tasks }: { tasks: { status: TaskStatusValue }[] }) {
  const counts = TASK_STATUSES.map(
    (status) => tasks.filter((t) => t.status === status).length,
  );
  const max = axisMax(counts);
  const barWidth = Math.min(34, (innerWidth / TASK_STATUSES.length) * 0.6);

  return (
    <ChartCard
      title="Tasks by status"
      description="Every card on this project, right now."
      empty={tasks.length === 0 ? "No tasks yet." : undefined}
    >
      <line
        x1={PLOT.padLeft}
        y1={PLOT.padTop + innerHeight}
        x2={PLOT.padLeft + innerWidth}
        y2={PLOT.padTop + innerHeight}
        stroke="var(--border)"
      />
      {TASK_STATUSES.map((status, i) => {
        const count = counts[i];
        const center = PLOT.padLeft + ((i + 0.5) / TASK_STATUSES.length) * innerWidth;
        const y = yAt(count, max);
        const color = taskStatusStyle(status).color;
        return (
          <g key={status}>
            <rect
              x={center - barWidth / 2}
              y={y}
              width={barWidth}
              height={PLOT.padTop + innerHeight - y}
              rx={3}
              fill={color}
              fillOpacity={0.8}
            >
              <title>{`${TASK_STATUS_COLUMN_LABEL[status]}: ${count}`}</title>
            </rect>
            <text
              x={center}
              y={y - 6}
              textAnchor="middle"
              className="text-micro"
              fill="var(--muted-foreground)"
            >
              {count}
            </text>
            <text
              x={center}
              y={PLOT.height - 8}
              textAnchor="middle"
              className="text-micro"
              fill="var(--muted-foreground)"
            >
              {TASK_STATUS_COLUMN_LABEL[status]}
            </text>
          </g>
        );
      })}
    </ChartCard>
  );
}
