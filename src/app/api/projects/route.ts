import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole } from "@/lib/auth-session";

const schema = z.object({
  name: z.string().min(2),
  slug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
});

export async function GET() {
  try {
    const { user, membership } = await requireMembership();
    const projects = await prisma.project.findMany({
      where: { teamId: membership.teamId },
      include: { memberships: { where: { userId: user.id } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        myRole: p.memberships[0]?.role ?? null,
      })),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 400 });
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
        memberships: { create: { userId: user.id, role: "pm" } },
      },
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: msg === "FORBIDDEN" ? 403 : 400 });
  }
}
