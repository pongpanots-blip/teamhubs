import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";
import { runContextPipeline } from "@/lib/context/pipeline";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  try {
    const { membership } = await requireMembership();
    const { id } = await params;
    const task = await prisma.task.findFirst({
      where: { id, teamId: membership.teamId },
    });
    if (!task) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const result = await runContextPipeline(task);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
