import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";
import { requireTaskAccess } from "@/lib/tasks/access";
import { errorResponse } from "@/lib/api-error";

const schema = z.object({
  decision: z.string().min(1),
  rationale: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    await requireTaskAccess(cx, id);

    const decisions = await prisma.decisionLog.findMany({
      where: { taskId: id },
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ decisions });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    await requireTaskAccess(cx, id);

    const body = schema.parse(await req.json());
    const decision = await prisma.decisionLog.create({
      data: {
        taskId: id,
        authorId: cx.user.id,
        decision: body.decision,
        rationale: body.rationale ?? "",
      },
      include: { author: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ decision }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
