import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";
import { requireTaskAccess } from "@/lib/tasks/access";
import { runContextPipeline } from "@/lib/context/pipeline";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    await requireTaskAccess(cx, id);
    const task = await prisma.task.findUniqueOrThrow({ where: { id } });

    const result = await runContextPipeline(task);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
