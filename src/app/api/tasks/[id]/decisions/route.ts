import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";

const schema = z.object({
  decision: z.string().min(1),
  rationale: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { membership } = await requireMembership();
    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: { id, teamId: membership.teamId },
      select: { id: true },
    });
    if (!task) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const decisions = await prisma.decisionLog.findMany({
      where: { taskId: id },
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ decisions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const { user, membership } = await requireMembership();
    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: { id, teamId: membership.teamId },
      select: { id: true },
    });
    if (!task) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const body = schema.parse(await req.json());
    const decision = await prisma.decisionLog.create({
      data: {
        taskId: id,
        authorId: user.id,
        decision: body.decision,
        rationale: body.rationale ?? "",
      },
      include: { author: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ decision }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
