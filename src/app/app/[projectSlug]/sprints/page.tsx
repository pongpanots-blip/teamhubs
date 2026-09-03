import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { SprintsPanel } from "@/components/sprints/sprints-panel";
import type { SprintCard, SprintSummary } from "@/components/sprints/types";
import type { TaskStatusValue } from "@/lib/task-constants";
import { capacityBreakdown, weeklyCapacityPoints } from "@/lib/sprint/capacity";
import { formatTaskKey } from "@/lib/tasks/task-key";

type Params = { params: Promise<{ projectSlug: string }> };

const CARD_FIELDS = {
  id: true,
  title: true,
  status: true,
  taskNumber: true,
  storyPoints: true,
  estimateHours: true,
  actualHours: true,
  actualHoursSource: true,
  // Who is carrying the card — the sprint screen groups by person.
  assignee: { select: { name: true } },
  // Shown nested under the card on the status board.
  subTasks: { select: { id: true, title: true, status: true } },
} as const;

export default async function SprintsPage({ params }: Params) {
  const { projectSlug } = await params;
  const { project, membership } = await requireProjectPage(projectSlug);
  // The API gates sprint changes on the *team* role, so the UI must too — a PM
  // whose project role is "backend" still manages the sprint.
  const canManage = membership.role === "pm";

  const [sprints, backlog, projectMembers] = await Promise.all([
    prisma.sprint.findMany({
      where: { projectId: project.id },
      orderBy: { startAt: "desc" },
      include: { tasks: { select: CARD_FIELDS, orderBy: { createdAt: "asc" } } },
    }),
    // Candidates for the next sprint: unfinished cards nobody has committed yet.
    prisma.task.findMany({
      where: { projectId: project.id, sprintId: null, status: { not: "done" } },
      select: CARD_FIELDS,
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.projectMembership.findMany({
      where: { projectId: project.id },
      select: { role: true },
    }),
  ]);

  // Capacity = headcount (UI + dev roles, PM excluded) × 7h/day, 1 point = 1 hour.
  const { total: capacityHeadcount } = capacityBreakdown(projectMembers);

  const toCard = (t: {
    id: string;
    title: string;
    status: string;
    taskNumber: number | null;
    storyPoints: number | null;
    estimateHours: number | null;
    actualHours: number | null;
    actualHoursSource: string | null;
    assignee: { name: string } | null;
    subTasks: { id: string; title: string; status: string }[];
  }): SprintCard => ({
    id: t.id,
    title: t.title,
    status: t.status as TaskStatusValue,
    taskKey: formatTaskKey(project.keyPrefix, t.taskNumber),
    storyPoints: t.storyPoints,
    estimateHours: t.estimateHours,
    actualHours: t.actualHours,
    actualHoursSource: t.actualHoursSource,
    assigneeName: t.assignee?.name ?? null,
    subTasks: t.subTasks.map((s) => ({
      id: s.id,
      title: s.title,
      status: s.status as TaskStatusValue,
    })),
  });

  const initialSprints: SprintSummary[] = sprints.map((s) => ({
    id: s.id,
    name: s.name,
    goal: s.goal,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    startedAt: s.startedAt?.toISOString() ?? null,
    completedAt: s.completedAt?.toISOString() ?? null,
    committedPoints: s.committedPoints,
    tasks: s.tasks.map(toCard),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-title font-semibold tracking-tight text-foreground">Sprints</h1>
        <p className="text-sm text-muted-foreground">
          Drag a card between the backlog and a sprint to commit or drop it. Starting a
          sprint freezes what was committed — anything moved after that shows up on the
          burndown as scope change.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Team capacity: {capacityHeadcount} {capacityHeadcount === 1 ? "person" : "people"}{" "}
          (UI + dev) × 7h/day ≈ {weeklyCapacityPoints(capacityHeadcount)} pts/week
        </p>
      </div>
      <SprintsPanel
        initialSprints={initialSprints}
        backlog={backlog.map(toCard)}
        projectSlug={project.slug}
        canManage={canManage}
        capacityHeadcount={capacityHeadcount}
      />
    </div>
  );
}
