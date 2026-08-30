import { prisma } from "@/lib/db";

export async function requireTeamFromPluginToken(req: Request) {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : "";
  if (!token) throw new Error("UNAUTHORIZED");
  const team = await prisma.team.findUnique({ where: { pluginToken: token } });
  if (!team) throw new Error("UNAUTHORIZED");
  return team;
}
