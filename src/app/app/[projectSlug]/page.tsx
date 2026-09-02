import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { MyWorkSection } from "@/components/home/my-work-section";
import { TeamSection, type TeamMemberRow } from "@/components/home/team-section";
import { AttentionSection } from "@/components/home/attention-section";
import { TasksByStatusChart } from "@/components/home/tasks-by-status-chart";
import { VelocityCard } from "@/components/home/velocity-card";
import { computeAttentionCounts, type HomeTask } from "@/lib/home";
import { capacityBreakdown, weeklyCapacityPoints } from "@/lib/sprint/capacity";
import { projectFlowMetrics } from "@/lib/analytics/project-metrics";
import { sprintBurndown } from "@/lib/sprint/service";
import { SleSummary } from "@/components/analytics/sle-summary";
import { AgingWipTable } from "@/components/analytics/aging-wip-table";
import { CycleTimeScatter } from "@/components/analytics/cycle-time-scatter";
import { ThroughputChart } from "@/components/analytics/throughput-chart";
import { CfdChart } from "@/components/analytics/cfd-chart";
import { BurndownChart } from "@/components/analytics/burndown-chart";

type Params = { params: Promise<{ projectSlug: string }> };

export default async function ProjectHomePage({ params }: Params) {
  const { projectSlug } = await params;
  const { user, project, role } = await requireProjectPage(projectSlug);

  const [tasks, memberships, activeSprint] = await Promise.all([
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
    // The sprint currently running — started, not yet closed. Falls back to
    // nothing rather than guessing at the most recent one.
    prisma.sprint.findFirst({
      where: { projectId: project.id, startedAt: { not: null }, completedAt: null },
      orderBy: { startAt: "desc" },
      select: { id: true },
    }),
  ]);

  const [metrics, burndown] = await Promise.all([
    projectFlowMetrics(project.id),
    activeSprint ? sprintBurndown(activeSprint.id) : null,
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

  const capacity = capacityBreakdown(memberships);

  return (
    <div className="space-y-8">
      <MyWorkSection tasks={myWorkTasks} projectSlug={project.slug} />
      <AttentionSection
        counts={computeAttentionCounts(homeTasks)}
        projectSlug={project.slug}
      />
      <VelocityCard
        headcount={capacity.total}
        uiCount={capacity.ui}
        devCount={capacity.dev}
        weeklyPoints={weeklyCapacityPoints(capacity.total)}
      />
      <TasksByStatusChart tasks={homeTasks} />
      <TeamSection members={teamMembers} projectSlug={project.slug} />

      <div>
        <h2 className="mb-3 text-section font-semibold text-foreground">Flow metrics</h2>
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <SleSummary sle={metrics.sle} windowDays={metrics.windowDays} />
            <AgingWipTable
              cards={metrics.aging}
              projectSlug={project.slug}
              sleMs={metrics.sle.p85}
            />
          </div>

          {burndown && (
            <BurndownChart days={burndown.days} sprintName={burndown.sprint.name} />
          )}

          <CycleTimeScatter
            points={metrics.completed.map((c) => ({
              taskId: c.taskId,
              title: c.title,
              doneAt: c.doneAt!.toISOString(),
              cycleTimeMs: c.cycleTimeMs!,
            }))}
            sle={metrics.sle}
            windowDays={metrics.windowDays}
            from={metrics.windowFrom.toISOString()}
            to={metrics.windowTo.toISOString()}
          />

          <div className="grid gap-6 lg:grid-cols-2">
            <ThroughputChart weeks={metrics.throughput} />
            <CfdChart days={metrics.cfd} />
          </div>
        </div>
      </div>
    </div>
  );
}
