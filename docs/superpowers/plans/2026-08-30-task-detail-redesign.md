# Task Detail Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder `/app/tasks/[id]` into the wireframe's single-column
sequence (header → Readiness → Requirement → Business Rules →
Dependencies → Design → GitHub → Internal Docs → Decisions teaser),
keeping the existing Decision log / AI advisory / Recent context runs
sections below it, unchanged in content and behavior.

**Architecture:** Single server component page
(`src/app/app/tasks/[id]/page.tsx`), rewritten with small local helper
functions per section (matching the file's existing `Field`/`Flag`
pattern). One small addition to `src/lib/task-constants.ts` for a short
priority label. One query change: nest `assignee` under
`dependsOn.dependency` so Dependencies can show each blocker's owner.

**Tech Stack:** Next.js 16 App Router, React 19 server components, Prisma,
Tailwind, existing shadcn-style UI kit (`Card`, `Badge`, `Button` from
`src/components/ui/`), `date-fns` (already a dependency) for date
formatting. No test framework is installed in this repo; this plan relies
on `tsc --noEmit` plus the manual verification steps below (same
convention used in the home-page plan).

## Global Constraints

- Business Rules render as `✓ {label}: {value}{unit ? " " + unit : ""}` —
  label included, not dropped.
- Dependencies render as a checkmark/hourglass + `{title} —
  {assigneeName ?? "Unassigned"}`; checkmark (✓) when
  `dependency.status === "done"`, hourglass (⏳) otherwise.
- Priority header uses a NEW short label (`Critical`/`High`/`Medium`/`Low`)
  distinct from the existing `TASK_PRIORITY_LABEL` ("P1 High" etc.) — add a
  new export, do not change or remove the existing one; other UI (the
  tasks table) still depends on the long form.
- Deadline formatted as `"Sep 2"` via `date-fns`'s `format(date, "MMM d")`;
  `"—"` when null.
- Decisions section here is a TEASER ONLY: `task.decisions[0]?.decision`
  text, linking via in-page anchor `href="#decision-log"` to the full
  Decision log section, which must carry `id="decision-log"`. Do not move
  the full decision log or its form out of their existing position — only
  reposition that whole card to appear after the new section stack.
- The GitHub section is omitted entirely (not rendered with empty-state
  copy) when `task.githubPrUrl` is not set.
- The Design section always renders (even with no `figmaUrl`), showing
  "No Figma linked yet." when absent — do NOT omit it the way GitHub is
  omitted.
- AI advisory and Recent context runs sections keep their exact current
  JSX, queries, and copy — only their position in the page changes.

---

### Task 1: Add short priority label and fix dependency-assignee query

**Files:**
- Modify: `src/lib/task-constants.ts`
- Modify: `src/app/app/tasks/[id]/page.tsx:30-41` (the `prisma.task.findFirst` call)

**Interfaces:**
- Produces (used by Task 2):
  - `export const TASK_PRIORITY_SHORT_LABEL: Record<TaskPriorityValue, string>` = `{ p0: "Critical", p1: "High", p2: "Medium", p3: "Low" }`
  - The `dependsOn` include now returns `dependency.assignee` (`{ name: string } | null`) alongside the existing `dependency.title`/`dependency.status` fields already used elsewhere in the file.

- [ ] **Step 1: Add the short priority label**

In `src/lib/task-constants.ts`, add directly below the existing `TASK_PRIORITY_LABEL` export:

```typescript
export const TASK_PRIORITY_SHORT_LABEL: Record<TaskPriorityValue, string> = {
  p0: "Critical",
  p1: "High",
  p2: "Medium",
  p3: "Low",
};
```

- [ ] **Step 2: Nest `assignee` under the dependency include**

In `src/app/app/tasks/[id]/page.tsx`, find the `prisma.task.findFirst` call (currently around lines 30-41):

```typescript
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
```

Change `dependsOn: { include: { dependency: true } }` to nest the
dependency's assignee:

```typescript
      dependsOn: {
        include: { dependency: { include: { assignee: true } } },
      },
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. The existing rendering of `task.dependsOn` further
down the file (currently around what will become the "kept" Links &
readiness flags content, or wherever it's still referenced before Task 2
rewrites it) still compiles because `dependency` still has `.title` and
`.status` — the include only adds a field, it doesn't remove any.

- [ ] **Step 4: Commit**

```bash
git add src/lib/task-constants.ts src/app/app/tasks/[id]/page.tsx
git commit -m "feat: add short priority label and dependency assignee to task query"
```

---

### Task 2: Rebuild the task detail page layout

**Files:**
- Modify: `src/app/app/tasks/[id]/page.tsx` (full rewrite of the returned JSX; imports and the query from Task 1 stay)

**Interfaces:**
- Consumes: `TASK_PRIORITY_SHORT_LABEL` from `@/lib/task-constants` (Task 1); the Task 1 query shape (`task.dependsOn[].dependency.assignee`).
- Produces: nothing further downstream — this is the page's final form.

- [ ] **Step 1: Rewrite `src/app/app/tasks/[id]/page.tsx`**

Replace the file's full contents with:

```tsx
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
  TASK_PRIORITY_LABEL,
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
```

Note: `task.requirement`, `task.acceptanceCriteria`, `task.description`,
and the readiness-flag `Flag` helper (`requirementPresent`, `rulesPresent`,
`apiReady`, `designLinked`, `figmaReady`) from the old "Links & readiness
flags" card are intentionally dropped from this page per the wireframe —
`acceptanceCriteria`/`description` and the flag list aren't in the
wireframe and the design doc doesn't call for keeping them as a separate
card. `figmaReady` itself is still surfaced (as the 🟢/⚪ indicator in
Design). If this turns out to drop something the team needs, that's a
follow-up, not a blocker for this task — the design doc's Non-goals
section scoped this to reordering + the wireframe's fields.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. In particular:
- `Button`'s `render={<a ... />}` prop must type-check against
  `@base-ui/react/button`'s `useRender` API — this repo already uses this
  exact pattern elsewhere (`DialogTrigger render={<Button />}` in
  `src/components/tasks/tasks-board.tsx`), so the pattern is proven; if
  `tsc` disagrees about the specific attributes on the inner `<a>`, check
  `src/components/ui/button.tsx`'s prop types and adjust only the JSX
  attributes, not the pattern itself.
- `format` from `date-fns` accepts `task.deadline` (a `Date | null` from
  Prisma) only after the `task.deadline ? ... : "—"` null check — do not
  call `format` unguarded.

- [ ] **Step 3: Manual verification**

Run: `pnpm dev`

In the browser, open a task that has every field populated (owner,
deadline, priority, status, business rules, at least one `done` dependency
and one non-`done` dependency, `figmaReady: true` with a `figmaUrl`, a
`githubPrUrl` containing `/pull/123`, at least one internal doc path, and
at least one decision) and confirm:
- Section order matches: header → Readiness bar+% → Requirement →
  Business Rules → Dependencies → Design → GitHub → Internal Docs →
  Decisions teaser → Decision log (full) → AI advisory → Recent context
  runs.
- Deadline reads like `"Sep 2"`, Priority reads like `"High"` (not
  `"P1 High"`).
- Dependencies show ✓ for the done one and ⏳ for the other, each with the
  dependency's assignee name.
- "Open Figma" button opens `figmaUrl` in a new tab.
- GitHub section shows `"PR #123"` linking to the PR URL.
- Clicking the Decisions teaser text jumps to the Decision log section.

Then open a task with every optional field empty/null (no owner, no
deadline, no business rules, no dependencies, no `figmaUrl`, no
`githubPrUrl`, no internal docs, no decisions) and confirm:
- No page crash.
- Owner shows "Unassigned", Deadline shows "—", Business Rules shows "No
  rules extracted yet.", Dependencies shows "—", Design shows "⚪ Not
  ready" + "No Figma linked yet." (section still renders), **GitHub
  section is not rendered at all** (not even an empty card), Internal Docs
  shows "—", Decisions teaser shows "No decisions yet.".

- [ ] **Step 4: Commit**

```bash
git add src/app/app/tasks/[id]/page.tsx
git commit -m "feat: reorder task detail page into wireframe section sequence"
```
