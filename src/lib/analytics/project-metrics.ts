import { prisma } from "@/lib/db";
import { computeTaskMetrics } from "@/lib/tasks/metrics";
import { serviceLevel, type ServiceLevel } from "@/lib/analytics/percentile";
import {
  agingWip,
  throughputByWeek,
  type AgingCard,
  type CardFlow,
  type ThroughputWeek,
} from "@/lib/analytics/flow";
import { TASK_STATUSES, type TaskStatusValue } from "@/lib/task-constants";

export const DEFAULT_WINDOW_DAYS = 90;

export type CfdDay = { date: string; counts: Record<TaskStatusValue, number> };

export type ProjectFlowMetrics = {
  windowDays: number;
  /** The window the numbers cover — also the x-axis the charts are drawn on. */
  windowFrom: Date;
  windowTo: Date;
  /** Finished cards in the window, for the scatter plot. */
  completed: CardFlow[];
  sle: ServiceLevel;
  throughput: ThroughputWeek[];
  aging: AgingCard[];
  cfd: CfdDay[];
};

/**
 * Everything the analytics page shows, derived from the transition log plus the
 * daily snapshots. Cards are grouped by *when they finished*, so the window is
 * a window on delivery, not on when work happened to start.
 */
export async function projectFlowMetrics(
  projectId: string,
  options: { windowDays?: number; now?: Date } = {},
): Promise<ProjectFlowMetrics> {
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
  const now = options.now ?? new Date();
  const from = new Date(now.getTime() - windowDays * 86_400_000);

  const tasks = await prisma.task.findMany({
    where: {
      projectId,
      // Unfinished cards are always relevant (they are the aging ones); finished
      // ones only if they landed inside the window.
      OR: [{ status: { not: "done" } }, { updatedAt: { gte: from } }],
    },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      statusHistory: {
        orderBy: { changedAt: "asc" },
        select: { fromStatus: true, toStatus: true, changedAt: true },
      },
    },
  });

  const cards: CardFlow[] = tasks.map((task) => {
    const metrics = computeTaskMetrics(
      {
        createdAt: task.createdAt,
        history: task.statusHistory.map((h) => ({
          fromStatus: h.fromStatus as TaskStatusValue | null,
          toStatus: h.toStatus as TaskStatusValue,
          changedAt: h.changedAt,
        })),
      },
      now,
    );
    const lastDone = [...task.statusHistory]
      .reverse()
      .find((h) => h.toStatus === "done");
    return {
      taskId: task.id,
      title: task.title,
      status: task.status as TaskStatusValue,
      cycleTimeMs: metrics.cycleTimeMs,
      doneAt: task.status === "done" ? (lastDone?.changedAt ?? null) : null,
      wipAgeMs: metrics.wipAgeMs,
    };
  });

  const completed = cards.filter(
    (c) => c.doneAt !== null && c.doneAt >= from && c.cycleTimeMs !== null,
  );
  const sle = serviceLevel(
    completed.map((c) => c.cycleTimeMs).filter((ms): ms is number => ms !== null),
  );

  return {
    windowDays,
    windowFrom: from,
    windowTo: now,
    completed,
    sle,
    throughput: throughputByWeek(completed, { from, to: now }),
    aging: agingWip(cards, sle.p85),
    cfd: await cumulativeFlow(projectId, from),
  };
}

/** Daily board census, oldest first. Missing days simply have no row. */
export async function cumulativeFlow(
  projectId: string,
  from: Date,
): Promise<CfdDay[]> {
  const rows = await prisma.flowSnapshot.findMany({
    where: { projectId, snapshotDate: { gte: from } },
    orderBy: { snapshotDate: "asc" },
  });

  const byDate = new Map<string, CfdDay>();
  for (const row of rows) {
    const date = row.snapshotDate.toISOString().slice(0, 10);
    let day = byDate.get(date);
    if (!day) {
      day = {
        date,
        counts: Object.fromEntries(TASK_STATUSES.map((s) => [s, 0])) as Record<
          TaskStatusValue,
          number
        >,
      };
      byDate.set(date, day);
    }
    day.counts[row.status as TaskStatusValue] = row.taskCount;
  }
  return [...byDate.values()];
}
