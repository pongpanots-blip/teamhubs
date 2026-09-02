import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

/**
 * Public lookup — no auth required. The token itself is the capability; a
 * visitor who isn't signed in yet still needs to see which email this invite
 * is for before they can register or sign in with it.
 */
export async function GET(_req: Request, { params }: Params) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { team: { select: { name: true } }, project: { select: { name: true } } },
  });
  if (!invite) {
    return NextResponse.json({ error: "INVALID_INVITE" }, { status: 404 });
  }

  const expired = invite.status === "pending" && invite.expiresAt < new Date();

  return NextResponse.json({
    email: invite.email,
    teamName: invite.team.name,
    projectName: invite.project?.name ?? null,
    status: expired ? "expired" : invite.status,
  });
}
