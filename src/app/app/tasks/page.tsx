import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { resolveCurrentProject } from "@/lib/current-project";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { TasksBoard } from "@/components/tasks/tasks-board";

export default async function TasksPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  });
  if (!membership) redirect("/onboarding");

  const { project, projects } = await resolveCurrentProject(membership);
  if (!project) redirect("/onboarding");

  const [tasks, allProjectMembers] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: project.id },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        dependsOn: {
          include: { dependency: { select: { id: true, title: true, status: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    // Every project's members, not just the current one — a grilling draft
    // is locked to the project it was started in, so the assignee dropdown
    // needs to filter by *that* project even if the header has since
    // switched to a different one.
    prisma.projectMembership.findMany({
      where: { project: { teamId: membership.teamId } },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);
  const projectSlugById = new Map(projects.map((p) => [p.id, p.slug]));

  return (
    <AppShell
      teamName={membership.team.name}
      role={membership.role}
      projects={projects}
      currentProjectSlug={project.slug}
    >
      <TasksBoard
        initialTasks={tasks}
        projects={projects}
        currentProjectSlug={project.slug}
        members={allProjectMembers.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          role: m.role,
          projectSlug: projectSlugById.get(m.projectId) ?? "",
        }))}
      />
    </AppShell>
  );
}
