import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { TasksBoard } from "@/components/tasks/tasks-board";
import { sprintOptions } from "@/lib/sprint/service";
import { computeTaskMetrics } from "@/lib/tasks/metrics";
import { formatTaskKey } from "@/lib/tasks/task-key";

type Params = { params: Promise<{ projectSlug: string }> };

export default async function TasksPage({ params }: Params) {
  const { projectSlug } = await params;
  const { project } = await requireProjectPage(projectSlug);

  const [tasks, sprints, memberships] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: project.id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        dependsOn: {
          include: {
            dependency: { select: { id: true, title: true, status: true } },
          },
        },
        statusHistory: { orderBy: { changedAt: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    // Every card on this screen can be committed from here, so offer the same
    // sprints the card's own page would.
    sprintOptions(project.id),
    prisma.projectMembership.findMany({
      where: { projectId: project.id },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  // Business-day age of the card's *current* status — the board's stagnant
  // filter and per-card indicator both read this, not the lifetime metrics.
  const tasksWithColumnAge = tasks.map((t) => ({
    ...t,
    taskKey: formatTaskKey(project.keyPrefix, t.taskNumber),
    daysInStatus: (() => {
      const ms = computeTaskMetrics({
        createdAt: t.createdAt,
        history: t.statusHistory,
      }).currentStatusMs;
      return ms === null ? null : Math.floor(ms / (24 * 60 * 60 * 1000));
    })(),
  }));

  return (
    <TasksBoard
      initialTasks={tasksWithColumnAge}
      projectName={project.name}
      currentProjectSlug={project.slug}
      sprints={sprints}
      members={memberships.map((m) => ({ id: m.user.id, name: m.user.name }))}
    />
  );
}
