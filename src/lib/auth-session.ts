import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import type { Membership, Team, TeamRole, User } from "@prisma/client";

export type AuthContext = {
  user: User;
  session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>;
  membership: Membership & { team: Team };
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
