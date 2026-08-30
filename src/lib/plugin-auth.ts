import { prisma } from "@/lib/db";

/** Figma plugin auth is per-project — a token identifies (and scopes to) one project. */
export async function requireProjectFromPluginToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("UNAUTHORIZED");
  const project = await prisma.project.findUnique({ where: { pluginToken: token } });
  if (!project) throw new Error("UNAUTHORIZED");
  return project;
}
