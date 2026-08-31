import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";
import { requireTaskAccess } from "@/lib/tasks/access";
import { errorResponse } from "@/lib/api-error";
import { forwardCompletionDoc } from "@/lib/tasks/completion-doc";

const schema = z.object({ content: z.string().min(1) });

type Params = { params: Promise<{ id: string }> };

/**
 * Manual completion-doc upload — the same forwarding a merged PR triggers,
 * but for when the dev wants to share it before/without a git-based deploy.
 * Never touches status: the PR-merge webhook stays the single source of
 * truth for "done".
 */
export async function POST(req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    await requireTaskAccess(cx, id);
    const body = schema.parse(await req.json());

    const task = await prisma.task.findUniqueOrThrow({ where: { id } });
    if (!task.component) {
      return NextResponse.json({ error: "NOT_A_COMPONENT_SUBTASK" }, { status: 400 });
    }

    const result = await forwardCompletionDoc({
      sourceTaskId: task.id,
      sourceComponent: task.component,
      title: `${task.title} — Completion notes`,
      content: body.content,
    });

    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
