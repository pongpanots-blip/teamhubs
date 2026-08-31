import { prisma } from "@/lib/db";
import { requireProjectById, type AuthContext, type ProjectContext } from "@/lib/auth-session";

/**
 * Scope for every task-by-id route. The project is read off the task itself
 * rather than the URL, so a slug and an id can never disagree — and a task in a
 * project the caller cannot open is indistinguishable from one that is not there.
 */
export async function requireTaskAccess(
  cx: AuthContext,
  taskId: string,
): Promise<ProjectContext & { taskId: string }> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, projectId: true },
  });
  if (!task) throw new Error("NOT_FOUND");
  const access = await requireProjectById(cx, task.projectId);
  return { ...access, taskId: task.id };
}

/**
 * Assigning work to someone who cannot open the project would hand them a task
 * they can never see. Rejects rather than silently dropping the assignee.
 */
export async function assertAssignable(projectId: string, userId: string | null | undefined) {
  if (!userId) return;
  const member = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) throw new Error("ASSIGNEE_NOT_IN_PROJECT");
}
