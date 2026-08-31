import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole } from "@/lib/auth-session";
import { requireSprintAccess } from "@/lib/sprint/access";
import { startSprint, completeSprint } from "@/lib/sprint/service";
import { errorResponse } from "@/lib/api-error";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  goal: z.string().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  /** Kick-off freezes the commitment; completion closes the box. */
  action: z.enum(["start", "complete"]).optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    const { id } = await params;
    await requireSprintAccess(cx, id);
    const sprint = await prisma.sprint.findUniqueOrThrow({
      where: { id },
      include: {
        tasks: {
          select: { id: true, title: true, status: true, storyPoints: true, assigneeId: true },
        },
      },
    });
    return NextResponse.json({ sprint });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    assertRole(cx.membership.role, ["pm"]);
    const { id } = await params;
    await requireSprintAccess(cx, id);
    const body = updateSchema.parse(await req.json());

    if (body.action === "start") {
      return NextResponse.json({ sprint: await startSprint(id) });
    }
    if (body.action === "complete") {
      return NextResponse.json({ sprint: await completeSprint(id) });
    }

    const sprint = await prisma.sprint.update({
      where: { id },
      data: {
        name: body.name,
        goal: body.goal,
        startAt: body.startAt ? new Date(body.startAt) : undefined,
        endAt: body.endAt ? new Date(body.endAt) : undefined,
      },
    });
    if (sprint.endAt <= sprint.startAt) throw new Error("END_BEFORE_START");
    return NextResponse.json({ sprint });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const cx = await requireMembership();
    assertRole(cx.membership.role, ["pm"]);
    const { id } = await params;
    await requireSprintAccess(cx, id);
    // Cards outlive the sprint: the FK is SET NULL, so they fall back to the
    // backlog rather than being deleted along with the time-box.
    await prisma.sprint.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
