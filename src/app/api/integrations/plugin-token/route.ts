import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole } from "@/lib/auth-session";

export async function GET() {
  try {
    const { membership } = await requireMembership();
    const team = await prisma.team.findUnique({
      where: { id: membership.teamId },
      select: { pluginToken: true },
    });
    return NextResponse.json({ hasToken: Boolean(team?.pluginToken) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST() {
  try {
    const { membership } = await requireMembership();
    assertRole(membership.role, ["pm", "backend", "mobile", "ai"]);
    const token = `figpi_${randomBytes(24).toString("hex")}`;
    await prisma.team.update({
      where: { id: membership.teamId },
      data: { pluginToken: token },
    });
    return NextResponse.json({ token });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
