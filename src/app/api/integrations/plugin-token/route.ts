import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMembership, requireProjectMembership, assertRole } from "@/lib/auth-session";

export async function GET() {
  try {
    const cx = await requireMembership();
    const { project } = await requireProjectMembership(cx);
    const row = await prisma.project.findUnique({
      where: { id: project.id },
      select: { pluginToken: true },
    });
    return NextResponse.json({ hasToken: Boolean(row?.pluginToken) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST() {
  try {
    const cx = await requireMembership();
    const { project, projectMembership } = await requireProjectMembership(cx);
    assertRole(projectMembership.role, ["pm", "backend", "mobile", "ai"]);
    const token = `figpi_${randomBytes(24).toString("hex")}`;
    await prisma.project.update({
      where: { id: project.id },
      data: { pluginToken: token },
    });
    return NextResponse.json({ token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
