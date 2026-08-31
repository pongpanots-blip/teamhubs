import { prisma } from "@/lib/db";
import { TASK_STATUSES } from "@/lib/task-constants";

/** Midnight UTC of the day `date` falls in — the key every snapshot is stored under. */
function utcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

/**
 * Record where every card sits today, for every project.
 *
 * Meant to run once a day. Re-running it for the same day overwrites that day's
 * rows rather than adding to them, so a retried cron job cannot double-count —
 * but it also means a late run records the board as it looks *then*, not at
 * midnight. Statuses with no cards are written as zero so the CFD has a
 * complete row and does not have to guess at gaps.
 */
export async function captureFlowSnapshot(
  now: Date = new Date(),
): Promise<{ projects: number; rows: number }> {
  const snapshotDate = utcDay(now);

  const grouped = await prisma.task.groupBy({
    by: ["projectId", "status"],
    _count: { id: true },
  });
  const projects = await prisma.project.findMany({ select: { id: true } });

  const counts = new Map(
    grouped.map((g) => [`${g.projectId}:${g.status}`, g._count.id]),
  );

  let rows = 0;
  for (const project of projects) {
    for (const status of TASK_STATUSES) {
      await prisma.flowSnapshot.upsert({
        where: {
          snapshotDate_projectId_status: {
            snapshotDate,
            projectId: project.id,
            status,
          },
        },
        create: {
          snapshotDate,
          projectId: project.id,
          status,
          taskCount: counts.get(`${project.id}:${status}`) ?? 0,
        },
        update: { taskCount: counts.get(`${project.id}:${status}`) ?? 0 },
      });
      rows++;
    }
  }

  return { projects: projects.length, rows };
}
