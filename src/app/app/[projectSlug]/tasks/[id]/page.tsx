import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { projectTask, projectTasks } from "@/lib/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RunContextButton } from "@/components/tasks/run-context-button";
import { StartWorkingButton } from "@/components/tasks/start-working-button";
import { DecisionLogForm } from "@/components/tasks/decision-log-form";
import { AddSubTaskForm } from "@/components/tasks/add-subtask-form";
import {
  RegenerateHandoffButton,
  DownloadHandoffButton,
  UploadCompletionDocForm,
} from "@/components/tasks/handoff-doc-actions";
import {
  MissingContextPanel,
  type MissingContextItem,
} from "@/components/tasks/missing-context-panel";
import { parseBusinessRules } from "@/lib/business-rules";
import { TaskStatusBadge } from "@/components/tasks/status-badge";
import {
  TASK_PRIORITY_SHORT_LABEL,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/lib/task-constants";

type Props = { params: Promise<{ projectSlug: string; id: string }> };

export default async function TaskDetailPage({ params }: Props) {
  const { projectSlug, id } = await params;
  const { project } = await requireProjectPage(projectSlug);

  // Scoped by project, not team — a task id from another project must read as
  // "not here", the same as one that does not exist.
  const task = await prisma.task.findFirst({
    where: { id, projectId: project.id },
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
      handoffDocs: { orderBy: { role: "asc" } },
      // businessRules: a sub-task has none of its own — it inherits the parent's.
      parent: { select: { id: true, title: true, businessRules: true } },
      subTasks: {
        include: { assignee: true, handoffDocs: { orderBy: { role: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!task) notFound();

  const status = task.status as TaskStatusValue;
  const priority = task.priority as TaskPriorityValue;
  // Business rules belong to the parent requirement — a sub-task inherits and
  // displays its parent's rules rather than showing an empty card.
  const parentTask = task.parent;
  const businessRules = parseBusinessRules(parentTask?.businessRules ?? task.businessRules);
  const prMatch = task.githubPrUrl?.match(/\/pull\/(\d+)/);

  const latestRunOutput = task.contextRuns[0]?.engineOutput as {
    missingContext?: string[];
    questionsForPm?: string[];
  } | null;
  const missingContextItems = buildMissingContextItems(task, latestRunOutput);

  const subTasks = task.subTasks;
  // Every sub-task is also a dependency (it blocks the parent) — list it once,
  // in the sub-tasks section, not again under Dependencies.
  const subTaskIds = new Set(subTasks.map((s) => s.id));
  const otherDeps = task.dependsOn.filter((d) => !subTaskIds.has(d.dependency.id));

  const completionDocs = task.handoffDocs.filter((d) => d.role.startsWith("completion:"));
  const genericHandoffDocs = task.handoffDocs.filter((d) => !d.role.startsWith("completion:"));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          {task.parent ? (
            <Link
              href={projectTask(project.slug, task.parent.id)}
              className="text-sm text-muted-foreground hover:underline"
            >
              ← {task.parent.title}
            </Link>
          ) : (
            <Link href={projectTasks(project.slug)} className="text-sm text-muted-foreground hover:underline">
              ← Tasks
            </Link>
          )}
          <h1 className="mt-1.5 text-[26px] font-semibold tracking-tight">{task.title}</h1>
          {subTasks.length > 0 ? (
            <span
              className="mt-2.5 inline-flex h-[22px] items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium"
              style={{ backgroundColor: "var(--violet-bg)", color: "var(--violet)" }}
            >
              ✶ {subTasks.length} sub-tasks
            </span>
          ) : null}
        </div>
        <div className="flex items-start gap-2">
          {status === "ready" || status === "assigned" ? (
            <StartWorkingButton taskId={task.id} />
          ) : null}
          <RunContextButton taskId={task.id} />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-4">
          <MissingContextPanel taskId={task.id} items={missingContextItems} />

          <div
            className="rounded-[14px] p-4"
            style={{ backgroundColor: "var(--violet-bg)", boxShadow: "0 0 0 1px oklch(0.52 0.14 300 / 0.25)" }}
          >
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-medium" style={{ color: "oklch(0.42 0.14 300)" }}>
                  Sub-tasks ({subTasks.length})
                </h2>
                <p className="mt-0.5 text-xs" style={{ color: "oklch(0.5 0.1 300)" }}>
                  Each sub-task is a task of its own — it has its own page, owner and status, and
                  blocks this one until it is done.
                </p>
              </div>
              <AddSubTaskForm parentId={task.id} projectSlug={project.slug} />
            </div>
            <div className="flex flex-col gap-2">
              {subTasks.map((sub) => {
                const doc = sub.handoffDocs[0];
                return (
                  <div
                    key={sub.id}
                    className="flex flex-wrap items-center gap-2 rounded-[10px] bg-card p-3 text-sm ring-1 ring-foreground/[0.06]"
                  >
                    <Link
                      href={projectTask(project.slug, sub.id)}
                      className="flex min-w-0 flex-1 flex-wrap items-center gap-2 hover:underline"
                    >
                      {sub.component ? (
                        <Badge variant="secondary" className="capitalize">
                          {sub.component}
                        </Badge>
                      ) : null}
                      <span className="font-medium">{sub.title}</span>
                      <span className="text-xs text-muted-foreground">
                        — {sub.assignee?.name ?? "Unassigned"}
                      </span>
                    </Link>
                    <TaskStatusBadge status={sub.status as TaskStatusValue} />
                    {doc ? (
                      <DownloadHandoffButton
                        fileName={`${sub.component ?? "sub"}-${sub.id}.md`}
                        content={doc.content}
                      />
                    ) : null}
                  </div>
                );
              })}
              {subTasks.length === 0 ? (
                <p className="text-xs" style={{ color: "oklch(0.5 0.1 300)" }}>
                  No sub-tasks yet.
                </p>
              ) : null}
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Readiness</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${task.readinessScore}%` }}
                />
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{task.readinessScore}%</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Requirement</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{task.requirement || "—"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Business Rules</CardTitle>
            </CardHeader>
            <CardContent>
              {parentTask ? (
                <p className="mb-2 text-xs text-muted-foreground">
                  Inherited from the parent task{" "}
                  <Link className="underline" href={projectTask(project.slug, parentTask.id)}>
                    {parentTask.title}
                  </Link>
                </p>
              ) : null}
              {businessRules.length === 0 ? (
                <p className="text-sm text-muted-foreground">No rules extracted yet.</p>
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

          <Card>
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
                  if (!out) return <p className="text-muted-foreground">No engine output.</p>;
                  return (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="text-muted-foreground">Context summary</div>
                        <p>{out.contextSummary || "—"}</p>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Engine decision</div>
                        <p>
                          Status <strong>{out.status}</strong> · Readiness{" "}
                          <strong>{out.readinessScore}</strong>
                        </p>
                        {out.blockedBy?.length ? (
                          <div
                            className="mt-2 rounded-[10px] p-2.5"
                            style={{ backgroundColor: "var(--destructive-bg)", boxShadow: "0 0 0 1px oklch(0.577 0.245 27.325 / 0.3)" }}
                          >
                            <p className="text-xs font-semibold text-destructive">🚧 Blocked</p>
                            {out.blockedBy.map((dep) => (
                              <p key={dep.id} className="text-xs text-destructive">
                                Waiting for <strong>{dep.title}</strong> ({dep.status})
                                {dep.assigneeName ? ` · Owner: ${dep.assigneeName}` : " · Unassigned"}
                              </p>
                            ))}
                          </div>
                        ) : null}
                        <p className="mt-2 text-xs text-muted-foreground">
                          Claude ไม่ตั้ง status/readiness — Deterministic Engine เป็นผู้ตัดสิน
                        </p>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Questions for PM</div>
                        <ul className="list-disc pl-5">
                          {(out.questionsForPm ?? []).map((q) => (
                            <li key={q}>{q}</li>
                          ))}
                          {(out.questionsForPm ?? []).length === 0 ? <li>—</li> : null}
                        </ul>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Missing context / conflicts</div>
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
                <p className="text-muted-foreground">Run context to see Claude analysis + engine output.</p>
              )}
            </CardContent>
          </Card>

          <Card id="decision-log">
            <CardHeader>
              <CardTitle className="text-base">Decision log</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <DecisionLogForm taskId={task.id} />
              <div className="space-y-2">
                {task.decisions.map((d) => (
                  <div key={d.id} className="rounded-[10px] bg-muted p-3 text-sm">
                    <div className="font-medium">{d.decision}</div>
                    {d.rationale ? <p className="text-muted-foreground">{d.rationale}</p> : null}
                    <div className="mt-1.5 text-xs text-muted-foreground">
                      {d.author.name} · {d.createdAt.toISOString()}
                    </div>
                  </div>
                ))}
                {task.decisions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No decisions yet.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">Handoff docs</CardTitle>
              <RegenerateHandoffButton taskId={task.id} />
            </CardHeader>
            <CardContent className="space-y-4">
              {genericHandoffDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No handoff docs yet — generated automatically once the task is ready, or via
                  Regenerate.
                </p>
              ) : (
                genericHandoffDocs.map((doc) => (
                  <div key={doc.id} className="rounded-[10px] bg-muted p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div>
                        <Badge className="mr-2">{doc.role}</Badge>
                        <span className="font-medium">{doc.title}</span>
                      </div>
                      <DownloadHandoffButton
                        fileName={`${task.title}-${doc.role}.md`}
                        content={doc.content}
                      />
                    </div>
                    <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                      {doc.content}
                    </pre>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {task.component ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-base">Completion docs</CardTitle>
                <UploadCompletionDocForm taskId={task.id} />
              </CardHeader>
              <CardContent className="space-y-4">
                {completionDocs.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nothing yet — merges a PR titled with{" "}
                    <code className="text-xs">{`[TASK-${task.id}]`}</code> and a{" "}
                    <code className="text-xs">{`docs/handoff/${task.id}.md`}</code> file, or an
                    Upload here, will populate this.
                  </p>
                ) : (
                  completionDocs.map((doc) => (
                    <div key={doc.id} className="rounded-[10px] bg-muted p-3 text-sm">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div>
                          <Badge className="mr-2">{doc.role.replace("completion:", "")}</Badge>
                          <span className="font-medium">{doc.title}</span>
                        </div>
                        <DownloadHandoffButton
                          fileName={`${task.title}-${doc.role}.md`}
                          content={doc.content}
                        />
                      </div>
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">
                        {doc.content}
                      </pre>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent context runs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {task.contextRuns.map((run) => (
                <div key={run.id} className="rounded-[10px] bg-muted p-3 text-xs">
                  <div className="mb-2 text-muted-foreground">{run.createdAt.toISOString()}</div>
                  <pre className="max-h-48 overflow-auto whitespace-pre-wrap">
                    {JSON.stringify(run.engineOutput, null, 2)}
                  </pre>
                </div>
              ))}
              {task.contextRuns.length === 0 ? (
                <p className="text-sm text-muted-foreground">No runs yet.</p>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-6">
          <SideCard title="Details">
            <FactRow k="Owner" v={task.assignee?.name ?? "Unassigned"} />
            <FactRow k="Priority" v={TASK_PRIORITY_SHORT_LABEL[priority]} />
            <FactRow k="Deadline" v={task.deadline ? format(task.deadline, "MMM d") : "—"} />
            <div className="flex items-center justify-between border-t border-border py-1.5 first:border-t-0">
              <span className="text-sm text-muted-foreground">Status</span>
              <TaskStatusBadge status={status} />
            </div>
          </SideCard>

          <SideCard title="Dependencies">
            {otherDeps.length === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : (
              otherDeps.map((d, i) => (
                <div
                  key={d.id}
                  className={`py-1.5 text-[12.5px] ${i > 0 ? "border-t border-border" : ""}`}
                >
                  <span className={d.dependency.status === "done" ? "text-[color:var(--st-done)]" : "text-muted-foreground"}>
                    {d.dependency.status === "done" ? "✓" : "⏳"}
                  </span>{" "}
                  {d.dependency.title} — {d.dependency.assignee?.name ?? "Unassigned"}
                </div>
              ))
            )}
          </SideCard>

          <SideCard title="Design">
            <div className="space-y-1.5 py-1 text-sm">
              <p>🎨 UI</p>
              <p>{task.figmaReady ? "🟢 Ready for Dev" : "⚪ Not ready"}</p>
              {task.figmaFile ? (
                <p className="text-xs text-muted-foreground">
                  {task.figmaFile}
                  {task.figmaPage ? ` › ${task.figmaPage}` : ""}
                  {task.figmaFrame ? ` › ${task.figmaFrame}` : ""}
                </p>
              ) : null}
              {task.figmaUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-1.5 w-full justify-center"
                  nativeButton={false}
                  render={<a href={task.figmaUrl} target="_blank" rel="noopener noreferrer" />}
                >
                  Open Figma
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground">No Figma linked yet.</p>
              )}
            </div>
          </SideCard>

          <SideCard title="Links & docs">
            {task.githubPrUrl ? (
              <div className="border-t border-border py-1.5 text-[12.5px] first:border-t-0">
                <a
                  href={task.githubPrUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[color:var(--st-ready)] hover:underline"
                >
                  {prMatch ? `PR #${prMatch[1]}` : task.githubPrUrl}
                </a>
              </div>
            ) : null}
            {task.internalDocPaths.map((p, i) => (
              <div
                key={p}
                className={`py-1.5 text-[12.5px] ${i > 0 || task.githubPrUrl ? "border-t border-border" : ""}`}
              >
                {p}
              </div>
            ))}
            {!task.githubPrUrl && task.internalDocPaths.length === 0 ? (
              <p className="text-xs text-muted-foreground">—</p>
            ) : null}
          </SideCard>

          <div className="rounded-[14px] bg-card p-3.5 ring-1 ring-foreground/[0.06]">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Decisions
              </h3>
            </div>
            {task.decisions[0] ? (
              <a href="#decision-log" className="text-sm hover:underline">
                {task.decisions[0].decision}
              </a>
            ) : (
              <p className="text-xs text-muted-foreground">No decisions yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SideCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-card p-3.5 ring-1 ring-foreground/[0.06]">
      <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function FactRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border py-1.5 text-sm first:border-t-0">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
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
      question: "มีตัวเลขหรือเงื่อนไขอะไรที่ต้องยึดไหม เช่น จำนวน วัน หรือเปอร์เซ็นต์?",
    });
  }
  if (!task.acPresent) {
    items.push({
      key: "ac",
      label: "Acceptance criteria missing",
      question: "ถ้างานนี้เสร็จแล้ว ผู้ใช้จะทำอะไรได้บ้าง? เล่าสั้น ๆ พอ",
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
