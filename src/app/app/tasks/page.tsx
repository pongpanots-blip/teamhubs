import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
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

  const tasks = await prisma.task.findMany({
    where: { teamId: membership.teamId },
    include: {
      assignee: { select: { id: true, name: true, email: true } },
      dependsOn: {
        include: { dependency: { select: { id: true, title: true, status: true } } },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <AppShell teamName={membership.team.name} role={membership.role}>
      <TasksBoard initialTasks={tasks} />
    </AppShell>
  );
}
