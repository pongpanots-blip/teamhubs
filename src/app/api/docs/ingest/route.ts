import { NextResponse } from "next/server";
import { requireMembership, assertRole } from "@/lib/auth-session";
import { importRepoDocsForTeam, reindexTeamDocs } from "@/lib/context/ingest";

/**
 * Re-embed the team's own docs (default), or seed the team from the repo's
 * `docs/**` bootstrap set with `?source=repo`.
 */
export async function POST(req: Request) {
  try {
    const { membership } = await requireMembership();
    assertRole(membership.role, ["pm", "ui", "backend", "mobile", "ai"]);
    const source = new URL(req.url).searchParams.get("source");
    const result =
      source === "repo"
        ? await importRepoDocsForTeam(membership.teamId)
        : await reindexTeamDocs(membership.teamId);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    const status = msg === "UNAUTHORIZED" ? 401 : msg === "FORBIDDEN" ? 403 : 500;
    if (status === 500) console.error(e);
    return NextResponse.json({ error: msg }, { status });
  }
}
