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
import {
  RegenerateHandoffButton,
  DownloadHandoffButton,
} from "@/components/tasks/handoff-doc-actions";
import {
  MissingContextPanel,
  type MissingContextItem,
} from "@/components/tasks/missing-context-panel";
import { parseBusinessRules } from "@/lib/business-rules";
import {
  TASK_PRIORITY_SHORT_LABEL,
  TASK_STATUS_LABEL,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/lib/task-constants";

const STATUS_BADGE_VARIANT: Record<
  TaskStatusValue,
  "default" | "secondary" | "destructive" | "outline"
> = {
  not_ready: "secondary",
  ready: "default",
  assigned: "outline",
  working: "default",
  blocked: "destructive",
  review: "outline",
  done: "secondary",
};

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
      handoffDocs: { orderBy: { role: "asc" } },
    },
  });
  if (!task) notFound();

  const status = task.status as TaskStatusValue;
  const priority = task.priority as TaskPriorityValue;
  const businessRules = parseBusinessRules(task.businessRules);
  const prMatch = task.githubPrUrl?.match(/\/pull\/(\d+)/);

  const latestRunOutput = task.contextRuns[0]?.engineOutput as {
    missingContext?: string[];
    questionsForPm?: string[];
  } | null;
  const missingContextItems = buildMissingContextItems(task, latestRunOutput);

  /** Sub-tasks created from a grilling session carry a component; plain dependencies don't. */
  const subTaskDeps = task.dependsOn.filter((d) => d.dependency.component != null);
  const otherDeps = task.dependsOn.filter((d) => d.dependency.component == null);

  return (
    <AppShell teamName={membership.team.name} role={membership.role}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href="/app/tasks" className="text-sm text-muted-foreground hover:underline">
              ← Tasks
            </Link>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">{task.title}</h1>
          </div>
          <RunContextButton taskId={task.id} />
        </div>

        <div className="grid gap-4 border-b border-border pb-6 sm:grid-cols-2 lg:grid-cols-4">
          <KeyValue label="Owner" value={task.assignee?.name ?? "Unassigned"} />
          <KeyValue label="Priority" value={TASK_PRIORITY_SHORT_LABEL[priority]} />
          <KeyValue
            label="Deadline"
            value={task.deadline ? format(task.deadline, "MMM d") : "—"}
          />
          <div>
            <div className="text-xs text-muted-foreground">Status</div>
            <Badge className="mt-1" variant={STATUS_BADGE_VARIANT[status]}>
              {TASK_STATUS_LABEL[status]}
            </Badge>
          </div>
        </div>

        <MissingContextPanel taskId={task.id} items={missingContextItems} />

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

        {subTaskDeps.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sub-tasks ({subTaskDeps.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {subTaskDeps.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/app/tasks/${d.dependency.id}`}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2 hover:bg-muted/50"
                    >
                      <Badge variant="outline">{d.dependency.component}</Badge>
                      <span className="font-medium">{d.dependency.title}</span>
                      <span className="text-muted-foreground">
                        — {d.dependency.assignee?.name ?? "Unassigned"}
                      </span>
                      <Badge
                        className="ml-auto"
                        variant={STATUS_BADGE_VARIANT[d.dependency.status as TaskStatusValue]}
                      >
                        {TASK_STATUS_LABEL[d.dependency.status as TaskStatusValue]}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dependencies</CardTitle>
          </CardHeader>
          <CardContent>
            {otherDeps.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {otherDeps.map((d) => (
                  <li key={d.id}>
                    {d.dependency.status === "done" ? "✓" : "⏳"} {d.dependency.title} —{" "}
                    {d.dependency.assignee?.name ?? "Unassigned"}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Design</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>🎨 UI</p>
            <p>{task.figmaReady ? "🟢 Ready for Dev" : "⚪ Not ready"}</p>
            {task.figmaFile ? (
              <p className="text-muted-foreground">
                {task.figmaFile}
                {task.figmaPage ? ` › ${task.figmaPage}` : ""}
                {task.figmaFrame ? ` › ${task.figmaFrame}` : ""}
              </p>
            ) : null}
            {task.figmaUrl ? (
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={task.figmaUrl} target="_blank" rel="noopener noreferrer" />}
              >
                Open Figma
              </Button>
            ) : (
              <p className="text-muted-foreground">No Figma linked yet.</p>
            )}
          </CardContent>
        </Card>

        {task.githubPrUrl ? (
          <Card>
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

        <Card>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Decisions</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {task.decisions[0] ? (
              <a href="#decision-log" className="hover:underline">
                {task.decisions[0].decision}
              </a>
            ) : (
              <p className="text-muted-foreground">No decisions yet.</p>
            )}
          </CardContent>
        </Card>

        <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Activity
        </p>

        <Card id="decision-log">
          <CardHeader>
            <CardTitle className="text-base">Decision log</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <DecisionLogForm taskId={task.id} />
            <div className="space-y-2">
              {task.decisions.map((d) => (
                <div key={d.id} className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
                  <div className="font-medium">{d.decision}</div>
                  {d.rationale ? <p className="text-muted-foreground">{d.rationale}</p> : null}
                  <div className="mt-1 text-xs text-muted-foreground">
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
                        <div className="mt-2 rounded border border-destructive/30 bg-destructive/10 p-2">
                          <p className="font-medium text-destructive">🚧 Blocked</p>
                          {out.blockedBy.map((dep) => (
                            <p key={dep.id} className="text-xs text-destructive">
                              Waiting for <strong>{dep.title}</strong> ({dep.status})
                              {dep.assigneeName ? ` · Owner: ${dep.assigneeName}` : " · Unassigned"}
                            </p>
                          ))}
                        </div>
                      ) : null}
                      <p className="text-xs text-muted-foreground">
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Handoff docs</CardTitle>
            <RegenerateHandoffButton taskId={task.id} />
          </CardHeader>
          <CardContent className="space-y-4">
            {task.handoffDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No handoff docs yet — generated automatically once the task is ready, or via
                Regenerate.
              </p>
            ) : (
              task.handoffDocs.map((doc) => (
                <div key={doc.id} className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent context runs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {task.contextRuns.map((run) => (
              <div key={run.id} className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
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
    </AppShell>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground">{label}</div>
      <p className="font-medium">{value}</p>
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
