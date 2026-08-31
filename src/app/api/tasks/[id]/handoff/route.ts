import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";
import { requireTaskAccess } from "@/lib/tasks/access";
import { errorResponse } from "@/lib/api-error";
import { syncHandoffDocs } from "@/lib/context/pipeline";
import { lastAnalysisFor } from "@/lib/engine/cascade";
import { runDeterministicEngine } from "@/lib/engine";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const cx = await requireMembership();
  const { id } = await params;
  try {
    await requireTaskAccess(cx, id);
  } catch (e) {
    return errorResponse(e);
  }

  const docs = await prisma.taskHandoff.findMany({
    where: { taskId: id },
    orderBy: { role: "asc" },
  });
  return NextResponse.json({ docs });
}

/** Regenerate handoff docs from the last analysis, without re-running the full RAG+Claude pipeline. */
export async function POST(_req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    await requireTaskAccess(cx, id);
    const task = await prisma.task.findUniqueOrThrow({ where: { id } });

    const [analysis, deps, siblings] = await Promise.all([
      lastAnalysisFor(task.id),
      prisma.taskDependency.findMany({
        where: { dependentId: task.id },
        include: { dependency: { include: { assignee: { select: { id: true, name: true } } } } },
      }),
      prisma.task.findMany({
        where: { projectId: task.projectId, id: { not: task.id } },
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
