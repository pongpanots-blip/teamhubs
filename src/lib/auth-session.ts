import { headers, cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Membership, Team, TeamRole, User, Project, ProjectMembership } from "@prisma/client";

export type AuthContext = {
  user: User;
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
  membership: Membership & { team: Team };
};

export type ProjectContext = {
  project: Project;
  projectMembership: ProjectMembership;
};

/** Cookie holding the slug of the project the user last switched to. */
export const CURRENT_PROJECT_COOKIE = "current_project";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireUser() {
  const session = await getSession();
  if (!session?.user) {
    throw new Error("UNAUTHORIZED");
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return { user, session };
}

export async function requireMembership(teamSlug?: string): Promise<AuthContext> {
  const { user, session } = await requireUser();
  const membership = await prisma.membership.findFirst({
    where: teamSlug
      ? { userId: user.id, team: { slug: teamSlug } }
      : { userId: user.id },
    include: { team: true },
    orderBy: { createdAt: "asc" },
  });
  if (!membership) {
    throw new Error("NO_TEAM");
  }
  return { user, session, membership };
}

export function assertRole(role: TeamRole, allowed: TeamRole[]) {
  if (!allowed.includes(role)) {
    throw new Error("FORBIDDEN");
  }
}

/**
 * Resolves the caller's current project within their team (by explicit slug,
 * else the `current_project` cookie, else the team's oldest project) and
 * confirms they're a member of it. Project-scoped resources (tasks, docs/RAG,
 * integration credentials) authorize against `projectMembership.role`, not
 * the team-wide `membership.role`.
 */
export async function requireProjectMembership(
  cx: AuthContext,
  projectSlug?: string,
): Promise<ProjectContext> {
  const slug = projectSlug ?? (await cookies()).get(CURRENT_PROJECT_COOKIE)?.value;
  const project = await prisma.project.findFirst({
    where: slug ? { teamId: cx.membership.teamId, slug } : { teamId: cx.membership.teamId },
    orderBy: { createdAt: "asc" },
  });
  if (!project) {
    throw new Error("NO_PROJECT");
  }

  const projectMembership = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: cx.user.id } },
  });
  if (!projectMembership) {
    throw new Error("FORBIDDEN");
  }

  return { project, projectMembership };
}
