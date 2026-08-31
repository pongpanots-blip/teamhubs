import { prisma } from "@/lib/db";
import { computeBurndown, type BurndownDay } from "@/lib/sprint/burndown";

/**
 * Log a card entering or leaving a sprint.
 *
 * Only *started* sprints are logged: moving cards around while a sprint is
 * still being planned is planning, not scope change, and logging it would
 * bury the mid-sprint additions the burndown exists to surface.
 */
export async function recordSprintMove(input: {
  taskId: string;
  from: string | null;
  to: string | null;
  points: number;
}): Promise<void> {
  if (input.from === input.to) return;

  const ids = [input.from, input.to].filter((id): id is string => Boolean(id));
  const sprints = await prisma.sprint.findMany({
    where: { id: { in: ids } },
    select: { id: true, startedAt: true, completedAt: true },
  });
  const started = new Set(
    sprints.filter((s) => s.startedAt && !s.completedAt).map((s) => s.id),
  );

  const rows = [
    input.from && started.has(input.from)
      ? { sprintId: input.from, action: "removed" as const }
      : null,
    input.to && started.has(input.to)
      ? { sprintId: input.to, action: "added" as const }
      : null,
  ].filter((r): r is { sprintId: string; action: "added" | "removed" } => r !== null);

  if (rows.length === 0) return;
  await prisma.sprintScopeChange.createMany({
    data: rows.map((r) => ({ ...r, taskId: input.taskId, points: input.points })),
  });
}

/**
 * Kick off a sprint, freezing the commitment from the cards in scope right now.
 * Re-starting is refused: overwriting `committedPoints` would erase the very
 * baseline scope creep is measured against.
 */
export async function startSprint(sprintId: string, now: Date = new Date()) {
  const sprint = await prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });
  if (sprint.startedAt) throw new Error("SPRINT_ALREADY_STARTED");

  const committed = await prisma.task.aggregate({
    where: { sprintId },
    _sum: { storyPoints: true },
  });

  return prisma.sprint.update({
    where: { id: sprintId },
    data: { startedAt: now, committedPoints: committed._sum.storyPoints ?? 0 },
  });
}

export async function completeSprint(sprintId: string, now: Date = new Date()) {
  const sprint = await prisma.sprint.findUniqueOrThrow({ where: { id: sprintId } });
  if (!sprint.startedAt) throw new Error("SPRINT_NOT_STARTED");
  if (sprint.completedAt) throw new Error("SPRINT_ALREADY_COMPLETED");
  return prisma.sprint.update({
    where: { id: sprintId },
    data: { completedAt: now },
  });
}

/**
 * Burndown for one sprint, read straight out of the transition log.
 *
 * A card counts as finished from its *last* entry into `done`. A card that was
 * reopened therefore reads as unfinished for the days in between — which
 * under-reports progress rather than claiming work that later came back.
 */
export async function sprintBurndown(
  sprintId: string,
  now: Date = new Date(),
): Promise<{ sprint: { id: string; name: string }; days: BurndownDay[] }> {
  const sprint = await prisma.sprint.findUniqueOrThrow({
    where: { id: sprintId },
    select: { id: true, name: true, startAt: true, endAt: true, committedPoints: true },
  });

  const [tasks, scopeChanges] = await Promise.all([
    prisma.task.findMany({
      where: { sprintId },
      select: {
        storyPoints: true,
        statusHistory: {
          where: { toStatus: "done" },
          orderBy: { changedAt: "desc" },
          take: 1,
          select: { changedAt: true },
        },
      },
    }),
    prisma.sprintScopeChange.findMany({
      where: { sprintId },
      orderBy: { changedAt: "asc" },
      select: { action: true, points: true, changedAt: true },
    }),
  ]);

  return {
    sprint: { id: sprint.id, name: sprint.name },
    days: computeBurndown(
      {
        startAt: sprint.startAt,
        endAt: sprint.endAt,
        committedPoints: sprint.committedPoints,
        tasks: tasks.map((t) => ({
          points: t.storyPoints ?? 0,
          doneAt: t.statusHistory[0]?.changedAt ?? null,
        })),
        scopeChanges,
      },
      now,
    ),
  };
}

/**
 * The sprints a card may be moved into, newest first. Closed sprints are left
 * out — committing to one would rewrite a number that has already been
 * reported on — except any listed in `keepIds`, so a card already sitting in a
 * closed sprint still shows where it actually is.
 */
export async function sprintOptions(
  projectId: string,
  keepIds: string[] = [],
): Promise<{ id: string; name: string; isActive: boolean; isClosed: boolean }[]> {
  const sprints = await prisma.sprint.findMany({
    where: {
      projectId,
      OR: [{ completedAt: null }, ...(keepIds.length ? [{ id: { in: keepIds } }] : [])],
    },
    orderBy: { startAt: "desc" },
    select: { id: true, name: true, startedAt: true, completedAt: true },
  });
  return sprints.map((s) => ({
    id: s.id,
    name: s.name,
    isActive: s.startedAt !== null && s.completedAt === null,
    isClosed: s.completedAt !== null,
  }));
}
