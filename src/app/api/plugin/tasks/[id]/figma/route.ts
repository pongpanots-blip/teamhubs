import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireTeamFromPluginToken } from "@/lib/plugin-auth";
import { httpUrlSchema } from "@/lib/url-schema";

const bodySchema = z.object({
  file: z.string().min(1),
  page: z.string().min(1),
  frame: z.string().min(1),
  url: httpUrlSchema,
  status: z.enum(["ready_for_dev", "not_ready"]),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  try {
    const team = await requireTeamFromPluginToken(req);
    const { id } = await params;
    const body = bodySchema.parse(await req.json());

    const existing = await prisma.task.findFirst({ where: { id, teamId: team.id } });
    if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

    const figmaReady = body.status === "ready_for_dev";
    const task = await prisma.task.update({
      where: { id },
      data: {
        figmaUrl: body.url,
        figmaFile: body.file,
        figmaPage: body.page,
        figmaFrame: body.frame,
        figmaReady,
        designLinked: true,
      },
    });

    return NextResponse.json({
      task: {
        id: task.id,
        title: task.title,
        figmaUrl: task.figmaUrl,
        figmaFile: task.figmaFile,
        figmaPage: task.figmaPage,
        figmaFrame: task.figmaFrame,
        figmaReady: task.figmaReady,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 400 });
  }
}
