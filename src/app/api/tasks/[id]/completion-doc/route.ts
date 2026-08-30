import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";
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
    const { membership } = await requireMembership();
    const { id } = await params;
    const body = schema.parse(await req.json());

    const task = await prisma.task.findFirst({ where: { id, teamId: membership.teamId } });
    if (!task) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
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
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
