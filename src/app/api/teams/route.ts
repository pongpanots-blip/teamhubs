import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth-session";

const schema = z.object({
  teamName: z.string().min(2),
  teamSlug: z
    .string()
    .min(2)
    .regex(/^[a-z0-9-]+$/),
});

export async function POST(req: Request) {
  try {
    const { user } = await requireUser();
    const body = schema.parse(await req.json());

    const existing = await prisma.membership.findFirst({ where: { userId: user.id } });
    if (existing) {
      return NextResponse.json({ error: "ALREADY_IN_TEAM" }, { status: 400 });
    }

    const team = await prisma.team.create({
      data: {
        name: body.teamName,
        slug: body.teamSlug,
        memberships: {
          create: {
            userId: user.id,
            role: "pm",
          },
        },
        projects: {
          create: {
            name: body.teamName,
            slug: "general",
            memberships: { create: { userId: user.id, role: "pm" } },
          },
        },
      },
    });

    return NextResponse.json({ team }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
