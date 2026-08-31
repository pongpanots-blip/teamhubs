import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireTeamPage } from "@/lib/page-context";
import { AppShell } from "@/components/layout/app-shell";
import { TeamSettingsPanels } from "@/components/settings/team-settings-panels";

/** Team-wide settings — no project in scope, so no project switcher. */
export default async function TeamSettingsPage() {
  const { membership, projects } = await requireTeamPage();
  if (membership.role !== "pm") notFound();

  const [invites, teamMembers] = await Promise.all([
    prisma.invite.findMany({
      where: { teamId: membership.teamId },
      include: { project: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.membership.findMany({
      where: { teamId: membership.teamId },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
  ]);

  return (
    <AppShell teamName={membership.team.name} role={membership.role}>
      <TeamSettingsPanels
        teamName={membership.team.name}
        invites={invites.map((i) => ({
          id: i.id,
          email: i.email,
          role: i.role,
          token: i.token,
          status: i.status,
          projectName: i.project?.name ?? null,
        }))}
        projects={projects.map((p) => ({ slug: p.slug, name: p.name }))}
        teamMembers={teamMembers.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
        }))}
      />
    </AppShell>
  );
}
