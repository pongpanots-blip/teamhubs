import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership, requireProjectMembership, assertRole } from "@/lib/auth-session";
import { encryptJson } from "@/lib/crypto";

const schema = z.object({
  provider: z.enum(["github", "figma"]),
  payload: z.record(z.string(), z.string()),
});

export async function GET() {
  try {
    const cx = await requireMembership();
    const { project } = await requireProjectMembership(cx);
    const rows = await prisma.integrationCredential.findMany({
      where: { projectId: project.id },
      select: { provider: true, updatedAt: true },
    });
    return NextResponse.json({ providers: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const cx = await requireMembership();
    const { membership } = cx;
    const { project, projectMembership } = await requireProjectMembership(cx);
    assertRole(projectMembership.role, ["pm", "backend", "mobile", "ai"]);
    const body = schema.parse(await req.json());
    const row = await prisma.integrationCredential.upsert({
      where: {
        projectId_provider: {
          projectId: project.id,
          provider: body.provider,
        },
      },
      create: {
        teamId: membership.teamId,
        projectId: project.id,
        provider: body.provider,
        payload: encryptJson(body.payload),
      },
      update: {
        payload: encryptJson(body.payload),
      },
    });
    return NextResponse.json({ provider: row.provider, updatedAt: row.updatedAt });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
