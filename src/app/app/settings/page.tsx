import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
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

  const [invites, providers] = await Promise.all([
    membership.role === "pm"
      ? prisma.invite.findMany({
          where: { teamId: membership.teamId },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    prisma.integrationCredential.findMany({
      where: { teamId: membership.teamId },
      select: { provider: true, updatedAt: true },
    }),
  ]);

  return (
    <AppShell teamName={membership.team.name} role={membership.role}>
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
      />
    </AppShell>
  );
}
