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
      prisma.invite.update({
        where: { id: invite.id },
        data: { status: "accepted" },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
