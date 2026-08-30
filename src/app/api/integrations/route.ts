import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole } from "@/lib/auth-session";
import { encryptJson } from "@/lib/crypto";

const schema = z.object({
  provider: z.enum(["github", "figma"]),
  payload: z.record(z.string(), z.string()),
});

export async function GET() {
  try {
    const { membership } = await requireMembership();
    const rows = await prisma.integrationCredential.findMany({
      where: { teamId: membership.teamId },
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
    const { membership } = await requireMembership();
    assertRole(membership.role, ["pm", "backend", "mobile", "ai"]);
    const body = schema.parse(await req.json());
    const row = await prisma.integrationCredential.upsert({
      where: {
        teamId_provider: {
          teamId: membership.teamId,
          provider: body.provider,
        },
      },
      create: {
        teamId: membership.teamId,
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
