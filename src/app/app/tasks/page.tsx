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

  const [tasks, members] = await Promise.all([
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
    prisma.projectMembership.findMany({
      where: { projectId: project.id },
      include: { user: { select: { id: true, name: true } } },
    }),
  ]);

  return (
    <AppShell
      teamName={membership.team.name}
      role={membership.role}
      projects={projects}
      currentProjectSlug={project.slug}
    >
      <TasksBoard
        initialTasks={tasks}
        members={members.map((m) => ({ id: m.user.id, name: m.user.name, role: m.role }))}
      />
    </AppShell>
  );
}
