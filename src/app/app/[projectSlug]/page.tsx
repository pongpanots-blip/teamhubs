import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { MyWorkSection } from "@/components/home/my-work-section";
import { TeamSection, type TeamMemberRow } from "@/components/home/team-section";
import { AttentionSection } from "@/components/home/attention-section";
import { computeAttentionCounts, type HomeTask } from "@/lib/home";

type Params = { params: Promise<{ projectSlug: string }> };

export default async function ProjectHomePage({ params }: Params) {
  const { projectSlug } = await params;
  const { user, project, role } = await requireProjectPage(projectSlug);

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
    role === "pm" ? homeTasks : homeTasks.filter((t) => t.assigneeId === user.id);

  const teamMembers: TeamMemberRow[] = memberships.map((m) => ({
    id: m.userId,
    name: m.user.name,
    role: m.role,
    tasks: homeTasks.filter((t) => t.assigneeId === m.userId),
  }));

  return (
    <div className="space-y-8">
      <MyWorkSection tasks={myWorkTasks} projectSlug={project.slug} />
      <AttentionSection
        counts={computeAttentionCounts(homeTasks)}
        projectSlug={project.slug}
      />
      <TeamSection members={teamMembers} projectSlug={project.slug} />
    </div>
  );
}
