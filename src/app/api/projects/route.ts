import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole, listAccessibleProjects } from "@/lib/auth-session";
import { errorResponse } from "@/lib/api-error";
import { deriveKeyPrefix } from "@/lib/tasks/task-key";

const schema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
});

/** Only projects the caller can actually open — a PM sees the whole team's. */
export async function GET() {
  try {
    const cx = await requireMembership();
    const projects = await listAccessibleProjects(cx);
    const myRoles = await prisma.projectMembership.findMany({
      where: { userId: cx.user.id, projectId: { in: projects.map((p) => p.id) } },
    });
    const roleByProject = new Map(myRoles.map((m) => [m.projectId, m.role]));
    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        myRole: roleByProject.get(p.id) ?? (cx.membership.role === "pm" ? "pm" : null),
      })),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { user, membership } = await requireMembership();
    assertRole(membership.role, ["pm"]);
    const body = schema.parse(await req.json());

    const project = await prisma.project.create({
      data: {
        teamId: membership.teamId,
        name: body.name,
        slug: body.slug,
        keyPrefix: deriveKeyPrefix(body.name),
        memberships: { create: { userId: user.id, role: "pm" } },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
