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
    const repository = await prisma.projectRepository.findUnique({
      where: { id },
      select: { id: true, projectId: true },
    });
    if (!repository) throw new Error("NOT_FOUND");
    // Scoped by project, not team — a repo id from another project reads as
    // "not here", the same as one that does not exist.
    await requireProjectById(cx, repository.projectId);
    await prisma.projectRepository.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
