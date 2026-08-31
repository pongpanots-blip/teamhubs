import { headers } from "next/headers";
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
  /** Null when access was granted by team-PM override rather than explicit membership. */
  projectMembership: ProjectMembership | null;
  /** Role to authorize against: the project role if any, else `pm` for the team PM. */
  role: TeamRole;
};

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
 * Grants access to `project` when the caller is a member of it, or is their
 * team's PM (PMs create projects and oversee all of them, so requiring them to
 * self-invite adds friction without adding safety).
 *
 * Returns null instead of throwing so callers can answer 404 — a non-member
 * should not be able to tell a project they cannot see from one that does not
 * exist.
 */
export async function projectAccess(
  cx: AuthContext,
  project: Project,
): Promise<ProjectContext | null> {
  if (project.teamId !== cx.membership.teamId) return null;

  const projectMembership = await prisma.projectMembership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: cx.user.id } },
  });
  if (projectMembership) {
    return { project, projectMembership, role: projectMembership.role };
  }
  if (cx.membership.role === "pm") {
    return { project, projectMembership: null, role: "pm" };
  }
  return null;
}

/**
 * Project scope for collection routes, which carry the slug explicitly (the
 * client always has it in the URL). Throws NOT_FOUND for both "no such project"
 * and "not yours" so the two are indistinguishable from outside.
 */
export async function requireProjectBySlug(
  cx: AuthContext,
  projectSlug: string,
): Promise<ProjectContext> {
  const project = await prisma.project.findFirst({
    where: { teamId: cx.membership.teamId, slug: projectSlug },
  });
  if (!project) throw new Error("NOT_FOUND");
  const access = await projectAccess(cx, project);
  if (!access) throw new Error("NOT_FOUND");
  return access;
}

/**
 * Project scope for resource routes, derived from the row itself. Taking the id
 * from the resource rather than the URL makes a slug/id mismatch impossible.
 */
export async function requireProjectById(
  cx: AuthContext,
  projectId: string,
): Promise<ProjectContext> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("NOT_FOUND");
  const access = await projectAccess(cx, project);
  if (!access) throw new Error("NOT_FOUND");
  return access;
}

/** Projects the caller may open — drives the switcher and the /app overview. */
export async function listAccessibleProjects(cx: AuthContext): Promise<Project[]> {
  return prisma.project.findMany({
    where:
      cx.membership.role === "pm"
        ? { teamId: cx.membership.teamId }
        : { teamId: cx.membership.teamId, memberships: { some: { userId: cx.user.id } } },
    orderBy: { createdAt: "asc" },
  });
}
