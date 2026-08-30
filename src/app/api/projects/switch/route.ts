import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { requireMembership, CURRENT_PROJECT_COOKIE } from "@/lib/auth-session";

const schema = z.object({ slug: z.string().min(1) });

/** Switch the user's active project — just sets which project subsequent requests resolve to. */
export async function POST(req: Request) {
  try {
    const { membership } = await requireMembership();
    const body = schema.parse(await req.json());

    const project = await prisma.project.findFirst({
      where: { teamId: membership.teamId, slug: body.slug },
    });
    if (!project) {
      return NextResponse.json({ error: "PROJECT_NOT_FOUND" }, { status: 404 });
    }

    (await cookies()).set(CURRENT_PROJECT_COOKIE, project.slug, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
    });
    return NextResponse.json({ project });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
