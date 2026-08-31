import { NextResponse } from "next/server";
import { requireMembership, assertRole } from "@/lib/auth-session";
import { requireProjectFromQuery } from "@/lib/project-scope";
import { errorResponse } from "@/lib/api-error";
import { importRepoDocsForTeam, reindexTeamDocs } from "@/lib/context/ingest";

/**
 * Re-embed the project's own docs (default), or seed the project from the
 * repo's `docs/**` bootstrap set with `?source=repo`.
 */
export async function POST(req: Request) {
  try {
    const cx = await requireMembership();
    const { membership } = cx;
    const { project, role } = await requireProjectFromQuery(cx, req);
    assertRole(role, ["pm", "ui", "website", "backend", "mobile", "ai"]);
    const source = new URL(req.url).searchParams.get("source");
    const result =
      source === "repo"
        ? await importRepoDocsForTeam(membership.teamId, project.id)
        : await reindexTeamDocs(project.id);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e);
  }
}
