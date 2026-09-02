import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { NewTaskTabs } from "@/components/tasks/new-task-tabs";
import { sprintOptions } from "@/lib/sprint/service";
import { isActiveWork, TASK_STATUSES } from "@/lib/task-constants";

type Params = { params: Promise<{ projectSlug: string }> };

export default async function NewTaskPage({ params }: Params) {
  const { projectSlug } = await params;
  const { project, projects } = await requireProjectPage(projectSlug);
  const projectIds = projects.map((p) => p.id);
  const activeStatuses = TASK_STATUSES.filter(isActiveWork);

  // Members of every project the viewer can open — a grilling draft stays
  // locked to the project it was started in, so its assignee dropdown must
  // filter by *that* project even when the page was opened from another one.
  const [members, sprints, workload] = await Promise.all([
    prisma.projectMembership.findMany({
      where: { projectId: { in: projectIds } },
      include: { user: { select: { id: true, name: true } } },
    }),
    // Only the current project's sprints — the quick form always creates in
    // the project this page was opened for.
    sprintOptions(project.id),
    // How many cards each candidate is actively carrying right now, per
    // project — the assignee picker uses this to suggest the least-loaded
    // matching person instead of leaving it to guesswork.
    prisma.task.groupBy({
      by: ["assigneeId", "projectId"],
      where: {
        projectId: { in: projectIds },
        assigneeId: { not: null },
        status: { in: activeStatuses },
      },
      _count: { _all: true },
    }),
  ]);

  const slugByProjectId = new Map(projects.map((p) => [p.id, p.slug]));
  const loadByMember = new Map(
    workload.map((w) => [`${w.projectId}:${w.assigneeId}`, w._count._all]),
  );

  return (
    <NewTaskTabs
      projects={projects.map((p) => ({ slug: p.slug, name: p.name }))}
      currentProjectSlug={project.slug}
      sprints={sprints}
      members={members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        role: m.role,
        projectSlug: slugByProjectId.get(m.projectId) ?? "",
        activeTaskCount: loadByMember.get(`${m.projectId}:${m.user.id}`) ?? 0,
      }))}
    />
  );
}
