import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { resolveCurrentProject } from "@/lib/current-project";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { SettingsPanels } from "@/components/settings/settings-panels";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  });
  if (!membership) redirect("/onboarding");

  const { project, projects } = await resolveCurrentProject(membership);
  if (!project) redirect("/onboarding");

  const [invites, providers, team, teamMembers, projectMembers] = await Promise.all([
    membership.role === "pm"
      ? prisma.invite.findMany({
          where: { teamId: membership.teamId },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.integrationCredential.findMany({
      where: { projectId: project.id },
      select: { provider: true, updatedAt: true },
    }),
    prisma.team.findUnique({
      where: { id: membership.teamId },
      select: { pluginToken: true },
    }),
    membership.role === "pm"
      ? prisma.membership.findMany({
          where: { teamId: membership.teamId },
          include: { user: { select: { id: true, name: true, email: true } } },
        })
      : Promise.resolve([]),
    membership.role === "pm"
      ? prisma.projectMembership.findMany({ where: { projectId: project.id } })
      : Promise.resolve([]),
  ]);
  const roleByUserId = new Map(projectMembers.map((pm) => [pm.userId, pm.role]));

  return (
    <AppShell
      teamName={membership.team.name}
      role={membership.role}
      projects={projects}
      currentProjectSlug={project.slug}
    >
      <SettingsPanels
        role={membership.role}
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          token: i.token,
          status: i.status,
        }))}
        providers={providers.map((p) => ({
          provider: p.provider,
          updatedAt: p.updatedAt.toISOString(),
        }))}
        hasPluginToken={Boolean(team?.pluginToken)}
        projects={projects}
        currentProjectId={project.id}
        currentProjectSlug={project.slug}
        teamMembers={teamMembers.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          projectRole: roleByUserId.get(m.user.id) ?? null,
        }))}
      />
    </AppShell>
  );
}
