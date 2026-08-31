import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { projectFlowMetrics } from "@/lib/analytics/project-metrics";
import { sprintBurndown } from "@/lib/sprint/service";
import { SleSummary } from "@/components/analytics/sle-summary";
import { AgingWipTable } from "@/components/analytics/aging-wip-table";
import { CycleTimeScatter } from "@/components/analytics/cycle-time-scatter";
import { ThroughputChart } from "@/components/analytics/throughput-chart";
import { CfdChart } from "@/components/analytics/cfd-chart";
import { BurndownChart } from "@/components/analytics/burndown-chart";

type Params = { params: Promise<{ projectSlug: string }> };

export default async function AnalyticsPage({ params }: Params) {
  const { projectSlug } = await params;
  const { project } = await requireProjectPage(projectSlug);

  // The sprint currently running — started, not yet closed. Falls back to
  // nothing rather than guessing at the most recent one.
  const activeSprint = await prisma.sprint.findFirst({
    where: { projectId: project.id, startedAt: { not: null }, completedAt: null },
    orderBy: { startAt: "desc" },
    select: { id: true },
  });

  const [metrics, burndown] = await Promise.all([
    projectFlowMetrics(project.id),
    activeSprint ? sprintBurndown(activeSprint.id) : null,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Analytics</h1>
        <p className="text-sm text-slate-600">
          Flow metrics for {project.name}, derived from every recorded status change.
        </p>
      </div>

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
  );
}
