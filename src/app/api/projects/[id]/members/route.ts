import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole } from "@/lib/auth-session";
import { TEAM_ROLES } from "@/lib/task-constants";

const schema = z.object({
  userId: z.string().min(1),
  role: z.enum(TEAM_ROLES),
});

/**
 * PM assigns a team member into a project with a role — separate from the
 * team-wide invite flow, since a user's role can differ per project.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { membership } = await requireMembership();
    assertRole(membership.role, ["pm"]);
    const { id: projectId } = await params;
    const body = schema.parse(await req.json());

    const project = await prisma.project.findFirst({
      where: { id: projectId, teamId: membership.teamId },
    });
    if (!project) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }
    const targetMembership = await prisma.membership.findFirst({
      where: { teamId: membership.teamId, userId: body.userId },
    });
    if (!targetMembership) {
      return NextResponse.json({ error: "USER_NOT_IN_TEAM" }, { status: 400 });
    }

    const row = await prisma.projectMembership.upsert({
      where: { projectId_userId: { projectId, userId: body.userId } },
      create: { projectId, userId: body.userId, role: body.role },
      update: { role: body.role },
    });
    return NextResponse.json({ projectMembership: row });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 400 });
  }
}
