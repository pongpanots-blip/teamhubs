import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireMembership, assertRole } from "@/lib/auth-session";
import { requireProjectFromQuery } from "@/lib/project-scope";
import { errorResponse } from "@/lib/api-error";

const FILE_KEY_PATTERN = /figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/;

const createSchema = z.object({
  /** A full Figma file URL — the file key is pulled out of it, never typed by hand. */
  fileUrl: z.string().min(1),
  name: z.string().min(1),
  isPrimary: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const cx = await requireMembership();
    const { project } = await requireProjectFromQuery(cx, req);
    const figmaFiles = await prisma.projectFigmaFile.findMany({
      where: { projectId: project.id },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    });
    return NextResponse.json({ figmaFiles });
  } catch (e) {
    return errorResponse(e);
  }
}

/** Only the PM registers which Figma files are this project's design source of truth. */
export async function POST(req: Request) {
  try {
    const cx = await requireMembership();
    assertRole(cx.membership.role, ["pm"]);
    const { project } = await requireProjectFromQuery(cx, req);
    const body = createSchema.parse(await req.json());

    const match = body.fileUrl.match(FILE_KEY_PATTERN);
    if (!match) return NextResponse.json({ error: "INVALID_FIGMA_URL" }, { status: 400 });

    const figmaFile = await prisma.projectFigmaFile.create({
      data: {
        projectId: project.id,
        fileKey: match[1],
        name: body.name,
        isPrimary: body.isPrimary ?? false,
      },
    });
    return NextResponse.json({ figmaFile }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
