import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { resolveCurrentProject } from "@/lib/current-project";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { MyWorkSection } from "@/components/home/my-work-section";
import { TeamSection, type TeamMemberRow } from "@/components/home/team-section";
import { AttentionSection } from "@/components/home/attention-section";
import { computeAttentionCounts, type HomeTask } from "@/lib/home";

export default async function AppHomePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  });
  if (!membership) redirect("/onboarding");

  const { project, projects } = await resolveCurrentProject(membership);
  if (!project) redirect("/onboarding");

  const [tasks, memberships] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: project.id },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        deadline: true,
        assigneeId: true,
        readinessScore: true,
        requirementPresent: true,
        rulesPresent: true,
        acPresent: true,
        figmaReady: true,
      },
    }),
    prisma.projectMembership.findMany({
      where: { projectId: project.id },
      include: { user: true },
    }),
  ]);

  const homeTasks: HomeTask[] = tasks;

  const myWorkTasks =
    membership.role === "pm"
      ? homeTasks
      : homeTasks.filter((t) => t.assigneeId === session.user.id);

  const teamMembers: TeamMemberRow[] = memberships.map((m) => ({
    id: m.userId,
    name: m.user.name,
    role: m.role,
    tasks: homeTasks.filter((t) => t.assigneeId === m.userId),
  }));

  const attentionCounts = computeAttentionCounts(homeTasks);

  return (
    <AppShell
      teamName={membership.team.name}
      role={membership.role}
      projects={projects}
      currentProjectSlug={project.slug}
    >
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">TeamHub</h1>
          <p className="text-sm text-slate-600">
            Who owns what vs who is working — Assigned ≠ Working.
          </p>
        </div>
        <MyWorkSection tasks={myWorkTasks} />
        <TeamSection members={teamMembers} />
        <AttentionSection counts={attentionCounts} />
      </div>
    </AppShell>
  );
}
