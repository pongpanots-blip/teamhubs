import { NextResponse } from "next/server";
import { z } from "zod";
import { addDays } from "date-fns";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole } from "@/lib/auth-session";

const schema = z.object({
  email: z.string().email(),
  role: z.enum(["pm", "ui", "dev"]).default("dev"),
});

export async function GET() {
  try {
    const { membership } = await requireMembership();
    assertRole(membership.role, ["pm"]);
    const invites = await prisma.invite.findMany({
      where: { teamId: membership.teamId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ invites });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: Request) {
  try {
    const { user, membership } = await requireMembership();
    assertRole(membership.role, ["pm"]);
    const body = schema.parse(await req.json());
    const invite = await prisma.invite.create({
      data: {
        teamId: membership.teamId,
        email: body.email.toLowerCase(),
        role: body.role,
        invitedById: user.id,
        expiresAt: addDays(new Date(), 14),
      },
    });
    return NextResponse.json({
      invite,
      acceptUrl: `/invite/${invite.token}`,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
