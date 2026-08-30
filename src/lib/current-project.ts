import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { CURRENT_PROJECT_COOKIE } from "@/lib/auth-session";
import type { Membership, Team } from "@prisma/client";

/**
 * Server-component helper: resolves which project the current request is
 * scoped to (cookie if set and valid, else the team's oldest project) and
 * the full project list for the team switcher. Every team always has at
 * least one project (created alongside the team), so `project` is only
 * undefined if that invariant was somehow broken.
 */
export async function resolveCurrentProject(membership: Membership & { team: Team }) {
  const slug = (await cookies()).get(CURRENT_PROJECT_COOKIE)?.value;
  const projects = await prisma.project.findMany({
    where: { teamId: membership.teamId },
    orderBy: { createdAt: "asc" },
  });
  const project = (slug && projects.find((p) => p.slug === slug)) ?? projects[0];
  return { project, projects };
}
