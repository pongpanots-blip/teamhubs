import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { TasksBoard } from "@/components/tasks/tasks-board";

type Params = { params: Promise<{ projectSlug: string }> };

export default async function TasksPage({ params }: Params) {
  const { projectSlug } = await params;
  const { project } = await requireProjectPage(projectSlug);

  const tasks = await prisma.task.findMany({
    where: { projectId: project.id },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      dependsOn: {
        include: { dependency: { select: { id: true, title: true, status: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return <TasksBoard initialTasks={tasks} projectName={project.name} currentProjectSlug={project.slug} />;
}
