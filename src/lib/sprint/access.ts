import { prisma } from "@/lib/db";
import { requireProjectById, type AuthContext, type ProjectContext } from "@/lib/auth-session";

/**
 * Scope for every sprint-by-id route. Same shape as task access: the project is
 * read off the sprint, so a sprint in a project the caller cannot open is
 * indistinguishable from one that does not exist.
 */
export async function requireSprintAccess(
  cx: AuthContext,
  sprintId: string,
): Promise<ProjectContext & { sprintId: string }> {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { id: true, projectId: true },
  });
  if (!sprint) throw new Error("NOT_FOUND");
  const access = await requireProjectById(cx, sprint.projectId);
  return { ...access, sprintId: sprint.id };
}

/**
 * Committing a card to another project's sprint would put it on a board its
 * own team never sees. Rejects rather than silently dropping the link.
 */
export async function assertSprintInProject(
  projectId: string,
  sprintId: string | null | undefined,
) {
  if (!sprintId) return;
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    select: { projectId: true },
  });
  if (!sprint || sprint.projectId !== projectId) {
    throw new Error("SPRINT_NOT_IN_PROJECT");
  }
}
