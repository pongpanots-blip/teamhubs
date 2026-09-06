import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership } from "@/lib/auth-session";
import { requireTaskAccess } from "@/lib/tasks/access";
import { errorResponse } from "@/lib/api-error";
import { parseMentions } from "@/lib/comments/mentions";

const schema = z.object({
  body: z.string().min(1),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    await requireTaskAccess(cx, id);

    const comments = await prisma.comment.findMany({
      where: { taskId: id },
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ comments });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    const access = await requireTaskAccess(cx, id);

    const body = schema.parse(await req.json());

    const members = await prisma.projectMembership.findMany({
      where: { projectId: access.project.id },
      include: { user: { select: { id: true, name: true } } },
    });
    const mentionedIds = parseMentions(
      body.body,
      members.map((m) => ({ id: m.user.id, name: m.user.name })),
    ).filter((userId) => userId !== cx.user.id); // no self-notification

    const comment = await prisma.comment.create({
      data: {
        taskId: id,
        authorId: cx.user.id,
        body: body.body,
        mentionedIds,
      },
      include: { author: { select: { id: true, name: true } } },
    });

    if (mentionedIds.length > 0) {
      const task = await prisma.task.findUniqueOrThrow({
        where: { id },
        select: { title: true, teamId: true, projectId: true },
      });
      await prisma.notification.createMany({
        data: mentionedIds.map((userId) => ({
          teamId: task.teamId,
          projectId: task.projectId,
          userId,
          taskId: id,
          type: "task_comment_mention" as const,
          title: `💬 ${cx.user.name} mentioned you in: ${task.title}`,
          body: body.body,
        })),
      });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
