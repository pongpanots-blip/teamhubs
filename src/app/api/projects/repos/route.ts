import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole } from "@/lib/auth-session";
import { requireProjectFromQuery } from "@/lib/project-scope";
import { errorResponse } from "@/lib/api-error";

const createSchema = z.object({
  owner: z.string().min(1),
  name: z.string().min(1),
  defaultBranch: z.string().min(1).default("main"),
  pathPrefix: z.string().optional().nullable(),
  isPrimary: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const cx = await requireMembership();
    const { project } = await requireProjectFromQuery(cx, req);
    const repositories = await prisma.projectRepository.findMany({
      where: { projectId: project.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ repositories });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Only the PM wires up which repos are this project's — dev/AI trust this registry to know where to push. */
export async function POST(req: Request) {
  try {
    const cx = await requireMembership();
    assertRole(cx.membership.role, ["pm"]);
    const { project } = await requireProjectFromQuery(cx, req);
    const body = createSchema.parse(await req.json());

    const repository = await prisma.projectRepository.create({
      data: {
        projectId: project.id,
        owner: body.owner,
        name: body.name,
        defaultBranch: body.defaultBranch,
        pathPrefix: body.pathPrefix || null,
        isPrimary: body.isPrimary ?? false,
      },
    });
    return NextResponse.json({ repository }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
