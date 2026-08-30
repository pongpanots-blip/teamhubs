import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";
import { syncHandoffDocs } from "@/lib/context/pipeline";
import { lastAnalysisFor } from "@/lib/engine/cascade";
import { runDeterministicEngine } from "@/lib/engine";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { membership } = await requireMembership();
  const { id } = await params;
  const task = await prisma.task.findFirst({ where: { id, teamId: membership.teamId } });
  if (!task) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  const docs = await prisma.taskHandoff.findMany({
    where: { taskId: id },
    orderBy: { role: "asc" },
  });
  return NextResponse.json({ docs });
}

/** Regenerate handoff docs from the last analysis, without re-running the full RAG+Claude pipeline. */
export async function POST(_req: Request, { params }: Params) {
  try {
    const { membership } = await requireMembership();
    const { id } = await params;
    const task = await prisma.task.findFirst({ where: { id, teamId: membership.teamId } });
    if (!task) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const [analysis, deps, siblings] = await Promise.all([
      lastAnalysisFor(task.id),
      prisma.taskDependency.findMany({
        where: { dependentId: task.id },
        include: { dependency: { include: { assignee: { select: { id: true, name: true } } } } },
      }),
      prisma.task.findMany({
        where: { teamId: task.teamId, id: { not: task.id } },
        select: { id: true, title: true, status: true },
      }),
    ]);

    const engineOutput = runDeterministicEngine({
      task,
      dependencies: deps.map((d) => ({
        id: d.dependency.id,
        title: d.dependency.title,
        status: d.dependency.status,
        assigneeId: d.dependency.assigneeId,
        assigneeName: d.dependency.assignee?.name ?? null,
      })),
      analysis,
      siblingTitles: siblings,
    });

    const docs = await syncHandoffDocs(task, analysis, engineOutput);
    return NextResponse.json({ docs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
