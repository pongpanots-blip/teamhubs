import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMembership, listAccessibleProjects } from "@/lib/auth-session";
import { errorResponse } from "@/lib/api-error";
import { prisma } from "@/lib/db";

const readSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

/**
 * Notifications span every project the caller can open, each tagged with its
 * project so the bell can deep-link — hiding them behind the project you happen
 * to have open would defeat the point of telling you something is waiting.
 * Projects the caller has left drop out of the filter automatically.
 */
export async function GET() {
  try {
    const cx = await requireMembership();
    const projects = await listAccessibleProjects(cx);
    const projectById = new Map(projects.map((p) => [p.id, p]));

    const notifications = await prisma.notification.findMany({
      where: { userId: cx.user.id, projectId: { in: projects.map((p) => p.id) } },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        taskId: true,
        projectId: true,
        readAt: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      notifications: notifications.map((n) => ({
        ...n,
        projectSlug: projectById.get(n.projectId)?.slug ?? null,
        projectName: projectById.get(n.projectId)?.name ?? null,
      })),
      unread: notifications.filter((n) => !n.readAt).length,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Mark notifications read — `{ all: true }` or `{ ids: [...] }`. */
export async function POST(req: Request) {
  try {
    const { user } = await requireMembership();
    const body = readSchema.parse(await req.json());
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        readAt: null,
        ...(body.all ? {} : { id: { in: body.ids ?? [] } }),
      },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
