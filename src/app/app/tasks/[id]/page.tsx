import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RunContextButton } from "@/components/tasks/run-context-button";
import { DecisionLogForm } from "@/components/tasks/decision-log-form";
import { parseBusinessRules } from "@/lib/business-rules";
import {
  TASK_PRIORITY_SHORT_LABEL,
  TASK_STATUS_LABEL,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/lib/task-constants";

type Props = { params: Promise<{ id: string }> };

export default async function TaskDetailPage({ params }: Props) {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  });
  if (!membership) redirect("/onboarding");

  const { id } = await params;
  const task = await prisma.task.findFirst({
    where: { id, teamId: membership.teamId },
    include: {
      assignee: true,
      dependsOn: {
        include: { dependency: { include: { assignee: true } } },
      },
      decisions: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      contextRuns: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });
  if (!task) notFound();

  const status = task.status as TaskStatusValue;
  const priority = task.priority as TaskPriorityValue;
  const businessRules = parseBusinessRules(task.businessRules);
  const prMatch = task.githubPrUrl?.match(/\/pull\/(\d+)/);

  return (
    <AppShell teamName={membership.team.name} role={membership.role}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/app/tasks" className="text-sm text-slate-500 hover:underline">
              ← Tasks
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{task.title}</h1>
          </div>
          <RunContextButton taskId={task.id} />
        </div>

        <Card className="border-black/5 bg-white/80">
          <CardContent className="grid gap-3 pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <KeyValue label="Owner" value={task.assignee?.name ?? "Unassigned"} />
            <KeyValue label="Priority" value={TASK_PRIORITY_SHORT_LABEL[priority]} />
            <KeyValue
              label="Deadline"
              value={task.deadline ? format(task.deadline, "MMM d") : "—"}
            />
            <div>
              <div className="text-slate-500">Status</div>
              <Badge className="mt-1">{TASK_STATUS_LABEL[status]}</Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Readiness</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${task.readinessScore}%` }}
              />
            </div>
            <p className="mt-1 text-sm text-slate-600">{task.readinessScore}%</p>
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Requirement</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{task.requirement || "—"}</p>
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Business Rules</CardTitle>
          </CardHeader>
          <CardContent>
            {businessRules.length === 0 ? (
              <p className="text-sm text-slate-500">No rules extracted yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {businessRules.map((r) => (
                  <li key={`${r.key}-${r.label}`}>
                    ✓ {r.label}: {r.value}
                    {r.unit ? ` ${r.unit}` : ""}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Dependencies</CardTitle>
          </CardHeader>
          <CardContent>
            {task.dependsOn.length === 0 ? (
              <p className="text-sm text-slate-500">—</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {task.dependsOn.map((d) => (
                  <li key={d.id}>
                    {d.dependency.status === "done" ? "✓" : "⏳"} {d.dependency.title} —{" "}
                    {d.dependency.assignee?.name ?? "Unassigned"}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Design</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>🎨 Figma</p>
            <p>{task.figmaReady ? "🟢 Ready for Dev" : "⚪ Not ready"}</p>
            {task.figmaUrl ? (
              <Button
                variant="outline"
                size="sm"
                render={<a href={task.figmaUrl} target="_blank" rel="noopener noreferrer" />}
              >
                Open Figma
              </Button>
            ) : (
              <p className="text-slate-500">No Figma linked yet.</p>
            )}
          </CardContent>
        </Card>

        {task.githubPrUrl ? (
          <Card className="border-black/5 bg-white/80">
            <CardHeader>
              <CardTitle className="text-base">GitHub</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <a
                href={task.githubPrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {prMatch ? `PR #${prMatch[1]}` : task.githubPrUrl}
              </a>
            </CardContent>
          </Card>
        ) : null}

        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Internal Docs</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc pl-5 text-sm">
              {task.internalDocPaths.map((p) => (
                <li key={p}>{p}</li>
              ))}
              {task.internalDocPaths.length === 0 ? <li>—</li> : null}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Decisions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {task.decisions[0] ? (
              <a href="#decision-log" className="hover:underline">
                {task.decisions[0].decision}
              </a>
            ) : (
              <p className="text-slate-500">No decisions yet.</p>
            )}
          </CardContent>
        </Card>

        <Card id="decision-log" className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Decision log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DecisionLogForm taskId={task.id} />
            <div className="space-y-2">
              {task.decisions.map((d) => (
                <div key={d.id} className="rounded-lg border border-black/5 p-3 text-sm">
                  <div className="font-medium">{d.decision}</div>
                  {d.rationale ? <p className="text-slate-600">{d.rationale}</p> : null}
                  <div className="mt-1 text-xs text-slate-400">
                    {d.author.name} · {d.createdAt.toISOString()}
                  </div>
                </div>
              ))}
              {task.decisions.length === 0 ? (
                <p className="text-sm text-slate-500">No decisions yet.</p>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">AI advisory (Claude) → Engine decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {task.contextRuns[0] ? (
              (() => {
                const out = task.contextRuns[0].engineOutput as {
                  contextSummary?: string;
                  questionsForPm?: string[];
                  missingContext?: string[];
                  conflicts?: { description: string; sources: string[] }[];
                  readinessScore?: number;
                  status?: string;
                  waitingFor?: string;
                  blockedBy?: {
                    id: string;
                    title: string;
                    status: string;
                    assigneeName: string | null;
                  }[];
                } | null;
                if (!out) return <p className="text-slate-500">No engine output.</p>;
                return (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <div className="text-slate-500">Context summary</div>
                      <p>{out.contextSummary || "—"}</p>
                    </div>
                    <div>
                      <div className="text-slate-500">Engine decision</div>
                      <p>
                        Status <strong>{out.status}</strong> · Readiness{" "}
                        <strong>{out.readinessScore}</strong>
                      </p>
                      {out.blockedBy?.length ? (
                        <div className="mt-2 rounded border border-amber-300 bg-amber-50 p-2">
                          <p className="font-medium text-amber-900">🚧 Blocked</p>
                          {out.blockedBy.map((dep) => (
                            <p key={dep.id} className="text-xs text-amber-800">
                              Waiting for <strong>{dep.title}</strong> ({dep.status})
                              {dep.assigneeName ? ` · Owner: ${dep.assigneeName}` : " · Unassigned"}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <p className="text-xs text-slate-400">
                        Claude ไม่ตั้ง status/readiness — Deterministic Engine เป็นผู้ตัดสิน
                      </p>
                    </div>
                    <div>
                      <div className="text-slate-500">Questions for PM</div>
                      <ul className="list-disc pl-5">
                        {(out.questionsForPm ?? []).map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                        {(out.questionsForPm ?? []).length === 0 ? <li>—</li> : null}
                      </ul>
                    </div>
                    <div>
                      <div className="text-slate-500">Missing context / conflicts</div>
                      <ul className="list-disc pl-5">
                        {(out.missingContext ?? []).map((m) => (
                          <li key={m}>{m}</li>
                        ))}
                        {(out.conflicts ?? []).map((c) => (
                          <li key={c.description}>Conflict: {c.description}</li>
                        ))}
                        {(out.missingContext ?? []).length + (out.conflicts ?? []).length === 0 ? (
                          <li>—</li>
                        ) : null}
                      </ul>
                    </div>
                  </div>
                );
              })()
            ) : (
              <p className="text-slate-500">Run context to see Claude analysis + engine output.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Recent context runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.contextRuns.map((run) => (
              <div key={run.id} className="rounded-lg border border-black/5 p-3 text-xs">
                <div className="mb-2 text-slate-500">{run.createdAt.toISOString()}</div>
                <pre className="max-h-48 overflow-auto whitespace-pre-wrap">
                  {JSON.stringify(run.engineOutput, null, 2)}
                </pre>
              </div>
            ))}
            {task.contextRuns.length === 0 ? (
              <p className="text-sm text-slate-500">No runs yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <p className="font-medium">{value}</p>
    </div>
  );
}
