import { requireProjectBySlug, type AuthContext, type ProjectContext } from "@/lib/auth-session";

/**
 * Project scope for collection routes. The slug is always explicit — the client
 * has it in its own URL — so there is no ambient state that can point a request
 * at a project the user is no longer looking at.
 */
export async function requireProjectFromQuery(
  cx: AuthContext,
  req: Request,
): Promise<ProjectContext> {
  const slug = new URL(req.url).searchParams.get("project");
  if (!slug) throw new Error("PROJECT_REQUIRED");
  return requireProjectBySlug(cx, slug);
}
