import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  getSession,
  listAccessibleProjects,
  projectAccess,
  type AuthContext,
} from "@/lib/auth-session";
import type { Project } from "@prisma/client";

/**
 * Server-component preamble shared by every /app page: signed in, on a team,
 * and (for project pages) allowed to open this project. Redirects rather than
 * throwing, because these are pages and not API calls.
 */
export async function requireTeamPage(): Promise<AuthContext & { projects: Project[] }> {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const [user, membership] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.membership.findFirst({
      where: { userId: session.user.id },
      include: { team: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  if (!user) redirect("/login");
  if (!membership) redirect("/onboarding");

  const cx = { user, session, membership };
  return { ...cx, projects: await listAccessibleProjects(cx) };
}

export async function requireProjectPage(projectSlug: string) {
  const cx = await requireTeamPage();
  const project = await prisma.project.findFirst({
    where: { teamId: cx.membership.teamId, slug: projectSlug },
  });
  // 404 for both "no such project" and "not yours" — a non-member should not be
  // able to tell the two apart.
  if (!project) notFound();
  const access = await projectAccess(cx, project);
  if (!access) notFound();
  return { ...cx, ...access };
}
