import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RunContextButton } from "@/components/tasks/run-context-button";
import { DecisionLogForm } from "@/components/tasks/decision-log-form";
import {
  MissingContextPanel,
  type MissingContextItem,
} from "@/components/tasks/missing-context-panel";
import { parseBusinessRules } from "@/lib/business-rules";
import {
  TASK_PRIORITY_LABEL,
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
      dependsOn: { include: { dependency: true } },
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

  const latestRunOutput = task.contextRuns[0]?.engineOutput as {
    missingContext?: string[];
    questionsForPm?: string[];
  } | null;
  const missingContextItems = buildMissingContextItems(task, latestRunOutput);

  return (
    <AppShell teamName={membership.team.name} role={membership.role}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/app/tasks" className="text-sm text-slate-500 hover:underline">
              ← Tasks
            </Link>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">{task.title}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge>{TASK_STATUS_LABEL[status]}</Badge>
              <Badge variant="outline">{TASK_PRIORITY_LABEL[priority]}</Badge>
              <Badge variant="outline">Readiness {task.readinessScore}</Badge>
              <Badge variant="secondary">
                Owner: {task.assignee?.name ?? "Unassigned"}
              </Badge>
            </div>
          </div>
          <RunContextButton taskId={task.id} />
        </div>

        <MissingContextPanel taskId={task.id} items={missingContextItems} />

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-black/5 bg-white/80">
            <CardHeader>
              <CardTitle className="text-base">Requirement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Field label="Requirement" value={task.requirement} />
              <Field label="Acceptance criteria" value={task.acceptanceCriteria} />
              <Field label="Description" value={task.description} />
              <div>
                <div className="text-slate-500">Deadline</div>
                <p>{task.deadline ? task.deadline.toISOString().slice(0, 10) : "—"}</p>
              </div>
              <div>
                <div className="text-slate-500">Readiness notes</div>
                <p>{task.readinessNotes || "—"}</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-black/5 bg-white/80">
            <CardHeader>
              <CardTitle className="text-base">BusinessRules[] (dynamic)</CardTitle>
            </CardHeader>
            <CardContent>
              {businessRules.length === 0 ? (
                <p className="text-sm text-slate-500">No rules extracted yet.</p>
              ) : (
                <dl className="space-y-2 text-sm">
                  {businessRules.map((r) => (
                    <div
                      key={`${r.key}-${r.label}`}
                      className="flex items-baseline justify-between gap-3 border-b border-black/5 pb-2"
                    >
                      <dt className="text-slate-500">{r.label}</dt>
                      <dd className="text-right font-medium">
                        {r.value}
                        {r.unit ? ` ${r.unit}` : ""}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
              <p className="mt-3 text-xs text-slate-400">
                Open-ended keys — not hardcoded coupon_discount / coupon_expiry columns.
              </p>
            </CardContent>
          </Card>

          <Card className="border-black/5 bg-white/80">
            <CardHeader>
              <CardTitle className="text-base">Links & readiness flags</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Flag label="Requirement present" on={task.requirementPresent} />
              <Flag label="Rules present" on={task.rulesPresent} />
              <Flag label="API ready" on={task.apiReady} />
              <Flag label="Figma linked" on={task.designLinked} />
              <Flag label="Figma ready" on={task.figmaReady} />
              <div>
                <div className="text-slate-500">Figma</div>
                <p className="break-all">{task.figmaUrl || "—"}</p>
              </div>
              <div>
                <div className="text-slate-500">GitHub issue</div>
                <p className="break-all">{task.githubIssueUrl || "—"}</p>
              </div>
              <div>
                <div className="text-slate-500">GitHub PR</div>
                <p className="break-all">{task.githubPrUrl || "—"}</p>
              </div>
              <div>
                <div className="text-slate-500">Internal docs</div>
                <ul className="list-disc pl-5">
                  {task.internalDocPaths.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                  {task.internalDocPaths.length === 0 ? <li>—</li> : null}
                </ul>
              </div>
              <div>
                <div className="text-slate-500">Dependencies</div>
                <ul className="list-disc pl-5">
                  {task.dependsOn.map((d) => (
                    <li key={d.id}>
                      {d.dependency.title} ({d.dependency.status}) · {d.source}
                    </li>
                  ))}
                  {task.dependsOn.length === 0 ? <li>—</li> : null}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="border-black/5 bg-white/80">
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

          <Card className="border-black/5 bg-white/80 lg:col-span-2">
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

          <Card className="border-black/5 bg-white/80 lg:col-span-2">
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
      </div>
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <p className="whitespace-pre-wrap">{value || "—"}</p>
    </div>
  );
}

function Flag({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{label}</span>
      <span className={on ? "text-emerald-700" : "text-amber-700"}>{on ? "yes" : "no"}</span>
    </div>
  );
}

function buildMissingContextItems(
  task: {
    requirementPresent: boolean;
    rulesPresent: boolean;
    acPresent: boolean;
  },
  latestRunOutput: { missingContext?: string[]; questionsForPm?: string[] } | null,
): MissingContextItem[] {
  const items: MissingContextItem[] = [];

  if (!task.requirementPresent) {
    items.push({
      key: "requirement",
      label: "Requirement not filled in",
      question: "ช่วยระบุ requirement ของงานนี้ให้ชัดเจนหน่อยได้ไหม?",
    });
  }
  if (!task.rulesPresent) {
    items.push({
      key: "rules",
      label: "Business rules missing",
      question: "Business rules ของงานนี้คืออะไรบ้าง?",
    });
  }
  if (!task.acPresent) {
    items.push({
      key: "ac",
      label: "Acceptance criteria missing",
      question: "Acceptance criteria ของงานนี้คืออะไร?",
    });
  }

  const engineItems = latestRunOutput?.missingContext ?? [];
  const questions = latestRunOutput?.questionsForPm ?? [];
  const seenLabels = new Set(items.map((i) => i.label.toLowerCase()));
  engineItems.forEach((label, index) => {
    if (seenLabels.has(label.toLowerCase())) return;
    seenLabels.add(label.toLowerCase());
    items.push({
      key: `engine-${index}`,
      label,
      question: questions[index] ?? `รบกวนช่วยชี้แจง: ${label}`,
    });
  });

  return items;
}
