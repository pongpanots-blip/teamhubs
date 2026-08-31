import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole } from "@/lib/auth-session";
import { requireProjectFromQuery } from "@/lib/project-scope";
import { errorResponse } from "@/lib/api-error";

const createSchema = z
  .object({
    name: z.string().min(1),
    goal: z.string().default(""),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
  })
  .refine((b) => new Date(b.endAt) > new Date(b.startAt), {
    message: "END_BEFORE_START",
    path: ["endAt"],
  });

export async function GET(req: Request) {
  try {
    const cx = await requireMembership();
    const { project } = await requireProjectFromQuery(cx, req);
    const sprints = await prisma.sprint.findMany({
      where: { projectId: project.id },
      orderBy: { startAt: "desc" },
      include: { _count: { select: { tasks: true } } },
    });
    return NextResponse.json({ sprints });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Only the PM opens a time-box — it is a commitment on the whole team. */
export async function POST(req: Request) {
  try {
    const cx = await requireMembership();
    assertRole(cx.membership.role, ["pm"]);
    const { project } = await requireProjectFromQuery(cx, req);
    const body = createSchema.parse(await req.json());

    const sprint = await prisma.sprint.create({
      data: {
        projectId: project.id,
        name: body.name,
        goal: body.goal,
        startAt: new Date(body.startAt),
        endAt: new Date(body.endAt),
      },
    });
    return NextResponse.json({ sprint }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
