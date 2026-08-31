import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireTeamPage } from "@/lib/page-context";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OverviewWorkList } from "@/components/home/overview-work-list";
import { computeAttentionCounts, isOpenStatus, type HomeTask } from "@/lib/home";
import { projectHome, TEAM_SETTINGS } from "@/lib/routes";

/**
 * Cross-project landing: everything assigned to me across every project I can
 * open, plus one card per project. Picking a project from here is what puts a
 * slug in the URL for the rest of the app.
 */
export default async function OverviewPage() {
  const { user, membership, projects } = await requireTeamPage();

  // Someone invited to the team but not yet to any project lands here. Onboarding
  // would bounce them straight back (they already have a team), so say what is
  // actually true instead of looping.
  if (projects.length === 0) {
    return (
      <AppShell teamName={membership.team.name} role={membership.role}>
        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-slate-900">
              No projects yet
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-slate-600">
            {membership.role === "pm" ? (
              <>
                Create your first project in{" "}
                <Link href={TEAM_SETTINGS} className="underline">
                  team settings
                </Link>
                .
              </>
            ) : (
              "You're on the team but not in any project yet — ask your PM to add you to one."
            )}
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const tasks = await prisma.task.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      deadline: true,
      assigneeId: true,
      projectId: true,
      readinessScore: true,
      requirementPresent: true,
      rulesPresent: true,
      acPresent: true,
      figmaReady: true,
    },
  });

  const byProject = new Map<string, HomeTask[]>(projects.map((p) => [p.id, []]));
  for (const task of tasks) byProject.get(task.projectId)?.push(task);

  const myTasks = tasks
    .filter((t) => t.assigneeId === user.id && isOpenStatus(t.status))
    .map((t) => ({
      ...t,
      projectSlug: projects.find((p) => p.id === t.projectId)?.slug ?? "",
    }));

  return (
    <AppShell teamName={membership.team.name} role={membership.role}>
      <div className="space-y-8">
        <OverviewWorkList tasks={myTasks} />

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-slate-900">Projects</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {projects.map((project) => {
              const projectTasks = byProject.get(project.id) ?? [];
              const counts = computeAttentionCounts(projectTasks);
              const open = projectTasks.filter((t) => isOpenStatus(t.status)).length;
              return (
                <Link key={project.id} href={projectHome(project.slug)}>
                  <Card className="h-full border-black/5 bg-white/80 transition hover:border-black/15">
                    <CardHeader>
                      <CardTitle className="text-base font-semibold text-slate-900">
                        {project.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                      <span>{open} open</span>
                      {counts.blocked > 0 ? (
                        <Badge variant="destructive">🚧 {counts.blocked} blocked</Badge>
                      ) : null}
                      {counts.missingContext > 0 ? (
                        <Badge variant="outline">⚠ {counts.missingContext} missing context</Badge>
                      ) : null}
                      {counts.uiReadyForDev > 0 ? (
                        <Badge variant="outline">🎨 {counts.uiReadyForDev} ready for dev</Badge>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
