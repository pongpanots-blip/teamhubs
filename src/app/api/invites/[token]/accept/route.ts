import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-session";

type Params = { params: Promise<{ token: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { user } = await requireUser();
    const { token } = await params;
    const invite = await prisma.invite.findUnique({ where: { token } });
    if (!invite || invite.status !== "pending") {
      return NextResponse.json({ error: "INVALID_INVITE" }, { status: 400 });
    }
    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "EXPIRED" }, { status: 400 });
    }
    if (invite.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: "EMAIL_MISMATCH" }, { status: 400 });
    }

    // A project-scoped invite lands the user in the team AND the project in one
    // step — otherwise they sign in to a team with nothing they can open.
    await prisma.$transaction([
      prisma.membership.upsert({
        where: {
          teamId_userId: { teamId: invite.teamId, userId: user.id },
        },
        create: {
          teamId: invite.teamId,
          userId: user.id,
          role: invite.role,
        },
        update: { role: invite.role },
      }),
      ...(invite.projectId
        ? [
            prisma.projectMembership.upsert({
              where: {
                projectId_userId: { projectId: invite.projectId, userId: user.id },
              },
              create: {
                projectId: invite.projectId,
                userId: user.id,
                role: invite.projectRole ?? invite.role,
              },
              update: { role: invite.projectRole ?? invite.role },
            }),
          ]
        : []),
      prisma.invite.update({
        where: { id: invite.id },
        data: { status: "accepted" },
      }),
    ]);

    const project = invite.projectId
      ? await prisma.project.findUnique({
          where: { id: invite.projectId },
          select: { slug: true },
        })
      : null;

    return NextResponse.json({ ok: true, projectSlug: project?.slug ?? null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
