import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole, requireProjectById } from "@/lib/auth-session";
import { errorResponse } from "@/lib/api-error";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const cx = await requireMembership();
    assertRole(cx.membership.role, ["pm"]);
    const figmaFile = await prisma.projectFigmaFile.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });
    if (!figmaFile) throw new Error("NOT_FOUND");
    await requireProjectById(cx, figmaFile.projectId);
    await prisma.projectFigmaFile.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
