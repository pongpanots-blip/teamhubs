import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireTeamFromPluginToken } from "@/lib/plugin-auth";

export async function GET(req: Request) {
  try {
    const team = await requireTeamFromPluginToken(req);
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const tasks = await prisma.task.findMany({
      where: {
        teamId: team.id,
        ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      },
      select: { id: true, title: true, status: true, figmaReady: true },
      orderBy: { updatedAt: "desc" },
      take: 25,
    });
    return NextResponse.json({ tasks });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 400 });
  }
}
