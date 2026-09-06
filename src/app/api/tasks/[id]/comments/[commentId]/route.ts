import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";
import { requireTaskAccess } from "@/lib/tasks/access";
import { errorResponse } from "@/lib/api-error";

const schema = z.object({
  body: z.string().min(1),
});

type Params = { params: Promise<{ id: string; commentId: string }> };

/** Only the author may edit or delete their own comment — not project role. */
async function requireOwnComment(userId: string, taskId: string, commentId: string) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.taskId !== taskId) throw new Error("NOT_FOUND");
  if (comment.authorId !== userId) throw new Error("FORBIDDEN");
  return comment;
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id, commentId } = await params;
    await requireTaskAccess(cx, id);
    await requireOwnComment(cx.user.id, id, commentId);

    const body = schema.parse(await req.json());
    const comment = await prisma.comment.update({
      where: { id: commentId },
      data: { body: body.body, editedAt: new Date() },
      include: { author: { select: { id: true, name: true } } },
    });
    return NextResponse.json({ comment });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id, commentId } = await params;
    await requireTaskAccess(cx, id);
    await requireOwnComment(cx.user.id, id, commentId);

    await prisma.comment.delete({ where: { id: commentId } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
