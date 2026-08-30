import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AppHomePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  });
  if (!membership) redirect("/onboarding");

  const [taskCount, readyCount, workingCount, chunkCount, runCount] = await Promise.all([
    prisma.task.count({ where: { teamId: membership.teamId } }),
    prisma.task.count({
      where: { teamId: membership.teamId, status: { in: ["ready", "assigned"] } },
    }),
    prisma.task.count({ where: { teamId: membership.teamId, status: "working" } }),
    prisma.docChunk.count({ where: { teamId: membership.teamId } }),
    prisma.contextRun.count({ where: { teamId: membership.teamId } }),
  ]);

  return (
    <AppShell teamName={membership.team.name} role={membership.role}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Overview</h1>
          <p className="text-sm text-slate-600">
            Who owns what vs who is working — Assigned ≠ Working.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: "Tasks", value: taskCount },
            { label: "Ready / Assigned", value: readyCount },
            { label: "Working", value: workingCount },
            { label: "Doc chunks", value: chunkCount },
            { label: "Context runs", value: runCount },
          ].map((s) => (
            <Card key={s.label} className="border-black/5 bg-white/80">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold">{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
