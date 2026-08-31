import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole } from "@/lib/auth-session";
import { requireProjectFromQuery } from "@/lib/project-scope";
import { errorResponse } from "@/lib/api-error";

export async function GET(req: Request) {
  try {
    const cx = await requireMembership();
    const { project } = await requireProjectFromQuery(cx, req);
    const row = await prisma.project.findUnique({
      where: { id: project.id },
      select: { pluginToken: true },
    });
    return NextResponse.json({ hasToken: Boolean(row?.pluginToken) });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const cx = await requireMembership();
    const { project, role } = await requireProjectFromQuery(cx, req);
    assertRole(role, ["pm", "backend", "mobile", "ai"]);
    const token = `figpi_${randomBytes(24).toString("hex")}`;
    await prisma.project.update({
      where: { id: project.id },
      data: { pluginToken: token },
    });
    return NextResponse.json({ token });
  } catch (e) {
    return errorResponse(e);
  }
}
