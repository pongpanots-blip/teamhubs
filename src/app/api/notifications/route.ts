import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMembership } from "@/lib/auth-session";
import { prisma } from "@/lib/db";

const readSchema = z.object({
  ids: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export async function GET() {
  try {
    const { user, membership } = await requireMembership();
    const notifications = await prisma.notification.findMany({
      where: { userId: user.id, teamId: membership.teamId },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        taskId: true,
        readAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({
      notifications,
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

function errorResponse(e: unknown) {
  const msg = e instanceof Error ? e.message : "ERROR";
  const status = msg === "UNAUTHORIZED" ? 401 : msg === "NO_TEAM" ? 403 : 400;
  return NextResponse.json({ error: msg }, { status });
}
