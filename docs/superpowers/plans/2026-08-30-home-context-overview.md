# Home Context Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/app` home page's generic stat-card grid with a
context-focused layout: My Work, Team, and Attention sections.

**Architecture:** Server component `src/app/app/page.tsx` fetches all team
tasks and memberships in one pass, then composes three new presentational
components under `src/components/home/`. Pure selection/aggregation logic
(which task is "current" for a member, attention counts) lives in a new
`src/lib/home.ts` module so it's testable without rendering or a database.

**Tech Stack:** Next.js 16 App Router, React 19 server components, Prisma,
Tailwind, existing shadcn-style UI kit (`Tabs`, `Badge`, `Card` from
`src/components/ui/`). No test framework is installed in this repo — this
plan follows the existing convention (see `scripts/smoke.ts`) of a
throw-on-failure `tsx` script for verifying logic.

## Global Constraints

- PM role sees every team task in "My Work" (not filtered by assignee); `dev`
  and `ui` roles see only tasks where `assigneeId === session.user.id`.
- "Active" status set (used for My Work's Active tab and for picking a
  member's current task in Team) = `ready, assigned, working, blocked,
  review`. This is distinct from the existing `isActiveWork()` in
  `src/lib/task-constants.ts`, which only covers `working`/`review` — do not
  reuse or rename that function.
- Missing Context = `readinessScore < 50 OR !requirementPresent OR
  !rulesPresent OR !acPresent`.
- Blocked = `status === "blocked"`.
- UI Ready for Dev = `figmaReady === true AND status IN (not_ready, ready)`.
- Attention counts are team-wide, not scoped by role.
- Team section's "current task" per member: lowest priority value first
  (`p0` < `p1` < `p2` < `p3`), then earliest `deadline` (nulls last), among
  that member's Active-status tasks. Show `+N more` if more than one Active
  task; "No active task" if zero.
- The old stat-card grid in `src/app/app/page.tsx` is removed entirely, not
  kept alongside the new sections.

---

### Task 1: Pure home-page logic (`src/lib/home.ts`)

**Files:**
- Create: `src/lib/home.ts`
- Test: `scripts/check-home-logic.ts`

**Interfaces:**
- Consumes: `TaskStatusValue`, `TaskPriorityValue`, `TASK_PRIORITIES` from
  `@/lib/task-constants`.
- Produces (used by Tasks 2, 3, 4, 5):
  - `export type HomeTask = { id: string; title: string; status: TaskStatusValue; priority: TaskPriorityValue; deadline: Date | null; assigneeId: string | null; readinessScore: number; requirementPresent: boolean; rulesPresent: boolean; acPresent: boolean; figmaReady: boolean; }`
  - `export const OPEN_STATUSES: TaskStatusValue[]` = `["ready", "assigned", "working", "blocked", "review"]`
  - `export function isOpenStatus(status: TaskStatusValue): boolean`
  - `export function pickCurrentTask(tasks: HomeTask[]): { task: HomeTask | null; extraCount: number }` — filters `tasks` to open ones, sorts by priority rank then deadline (nulls last), returns the top task and `extraCount = openTasks.length - (task ? 1 : 0)`.
  - `export type AttentionCounts = { missingContext: number; blocked: number; uiReadyForDev: number }`
  - `export function computeAttentionCounts(tasks: HomeTask[]): AttentionCounts`
  - `export function isMissingContext(task: HomeTask): boolean`
  - `export function isUiReadyForDev(task: HomeTask): boolean`

- [ ] **Step 1: Write the failing check script**

Create `scripts/check-home-logic.ts`:

```typescript
import {
  isOpenStatus,
  pickCurrentTask,
  computeAttentionCounts,
  isMissingContext,
  isUiReadyForDev,
  type HomeTask,
} from "../src/lib/home";

function baseTask(overrides: Partial<HomeTask>): HomeTask {
  return {
    id: "t1",
    title: "Task",
    status: "ready",
    priority: "p2",
    deadline: null,
    assigneeId: null,
    readinessScore: 80,
    requirementPresent: true,
    rulesPresent: true,
    acPresent: true,
    figmaReady: false,
    ...overrides,
  };
}

function assertEqual(actual: unknown, expected: unknown, label: string) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error(`${label}: expected ${e}, got ${a}`);
  }
  console.log(`ok - ${label}`);
}

// isOpenStatus
assertEqual(isOpenStatus("ready"), true, "ready is open");
assertEqual(isOpenStatus("assigned"), true, "assigned is open");
assertEqual(isOpenStatus("working"), true, "working is open");
assertEqual(isOpenStatus("blocked"), true, "blocked is open");
assertEqual(isOpenStatus("review"), true, "review is open");
assertEqual(isOpenStatus("not_ready"), false, "not_ready is not open");
assertEqual(isOpenStatus("done"), false, "done is not open");

// pickCurrentTask: empty
assertEqual(
  pickCurrentTask([]),
  { task: null, extraCount: 0 },
  "pickCurrentTask empty",
);

// pickCurrentTask: excludes non-open statuses
{
  const result = pickCurrentTask([
    baseTask({ id: "done1", status: "done" }),
    baseTask({ id: "notready1", status: "not_ready" }),
  ]);
  assertEqual(result, { task: null, extraCount: 0 }, "pickCurrentTask excludes closed");
}

// pickCurrentTask: picks lowest priority rank first
{
  const p2 = baseTask({ id: "p2task", priority: "p2", status: "ready" });
  const p0 = baseTask({ id: "p0task", priority: "p0", status: "working" });
  const result = pickCurrentTask([p2, p0]);
  assertEqual(result.task?.id, "p0task", "pickCurrentTask prefers p0 over p2");
  assertEqual(result.extraCount, 1, "pickCurrentTask extraCount counts remainder");
}

// pickCurrentTask: same priority, earlier deadline wins; null deadline last
{
  const later = baseTask({
    id: "later",
    priority: "p1",
    status: "ready",
    deadline: new Date("2026-09-10"),
  });
  const sooner = baseTask({
    id: "sooner",
    priority: "p1",
    status: "ready",
    deadline: new Date("2026-09-01"),
  });
  const noDeadline = baseTask({
    id: "nodeadline",
    priority: "p1",
    status: "ready",
    deadline: null,
  });
  const result = pickCurrentTask([later, noDeadline, sooner]);
  assertEqual(result.task?.id, "sooner", "pickCurrentTask prefers earlier deadline");
  assertEqual(result.extraCount, 2, "pickCurrentTask extraCount with 3 open tasks");
}

// isMissingContext
assertEqual(
  isMissingContext(baseTask({ readinessScore: 49 })),
  true,
  "isMissingContext true when score < 50",
);
assertEqual(
  isMissingContext(baseTask({ readinessScore: 90, requirementPresent: false })),
  true,
  "isMissingContext true when requirement missing",
);
assertEqual(
  isMissingContext(
    baseTask({ readinessScore: 90, requirementPresent: true, rulesPresent: true, acPresent: true }),
  ),
  false,
  "isMissingContext false when score high and all present",
);

// isUiReadyForDev
assertEqual(
  isUiReadyForDev(baseTask({ figmaReady: true, status: "ready" })),
  true,
  "isUiReadyForDev true for figmaReady + ready",
);
assertEqual(
  isUiReadyForDev(baseTask({ figmaReady: true, status: "not_ready" })),
  true,
  "isUiReadyForDev true for figmaReady + not_ready",
);
assertEqual(
  isUiReadyForDev(baseTask({ figmaReady: true, status: "working" })),
  false,
  "isUiReadyForDev false once work has started",
);
assertEqual(
  isUiReadyForDev(baseTask({ figmaReady: false, status: "ready" })),
  false,
  "isUiReadyForDev false when figma not ready",
);

// computeAttentionCounts
{
  const tasks: HomeTask[] = [
    baseTask({ id: "missing1", readinessScore: 10 }),
    baseTask({ id: "blocked1", status: "blocked", readinessScore: 90 }),
    baseTask({ id: "uiready1", figmaReady: true, status: "ready", readinessScore: 90 }),
    baseTask({ id: "fine1", readinessScore: 90 }),
  ];
  const counts = computeAttentionCounts(tasks);
  assertEqual(
    counts,
    { missingContext: 1, blocked: 1, uiReadyForDev: 1 },
    "computeAttentionCounts tallies each bucket independently",
  );
}

console.log("All home logic checks passed.");
```

- [ ] **Step 2: Run the check script to verify it fails**

Run: `npx tsx scripts/check-home-logic.ts`
Expected: FAIL — module `../src/lib/home` has no exported member(s) (TypeScript compile error via tsx), since `src/lib/home.ts` doesn't exist yet.

- [ ] **Step 3: Implement `src/lib/home.ts`**

```typescript
import {
  TASK_PRIORITIES,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/lib/task-constants";

export type HomeTask = {
  id: string;
  title: string;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  deadline: Date | null;
  assigneeId: string | null;
  readinessScore: number;
  requirementPresent: boolean;
  rulesPresent: boolean;
  acPresent: boolean;
  figmaReady: boolean;
};

/**
 * Statuses that represent work still in play. Distinct from
 * task-constants.ts's isActiveWork(), which only covers working/review.
 */
export const OPEN_STATUSES: TaskStatusValue[] = [
  "ready",
  "assigned",
  "working",
  "blocked",
  "review",
];

export function isOpenStatus(status: TaskStatusValue): boolean {
  return OPEN_STATUSES.includes(status);
}

function priorityRank(priority: TaskPriorityValue): number {
  return TASK_PRIORITIES.indexOf(priority);
}

export function pickCurrentTask(
  tasks: HomeTask[],
): { task: HomeTask | null; extraCount: number } {
  const open = tasks.filter((t) => isOpenStatus(t.status));
  if (open.length === 0) return { task: null, extraCount: 0 };

  const sorted = [...open].sort((a, b) => {
    const rankDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (rankDiff !== 0) return rankDiff;
    if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  return { task: sorted[0], extraCount: sorted.length - 1 };
}

export function isMissingContext(task: HomeTask): boolean {
  return (
    task.readinessScore < 50 ||
    !task.requirementPresent ||
    !task.rulesPresent ||
    !task.acPresent
  );
}

export function isUiReadyForDev(task: HomeTask): boolean {
  return (
    task.figmaReady &&
    (task.status === "not_ready" || task.status === "ready")
  );
}

export type AttentionCounts = {
  missingContext: number;
  blocked: number;
  uiReadyForDev: number;
};

export function computeAttentionCounts(tasks: HomeTask[]): AttentionCounts {
  let missingContext = 0;
  let blocked = 0;
  let uiReadyForDev = 0;
  for (const task of tasks) {
    if (isMissingContext(task)) missingContext++;
    if (task.status === "blocked") blocked++;
    if (isUiReadyForDev(task)) uiReadyForDev++;
  }
  return { missingContext, blocked, uiReadyForDev };
}
```

- [ ] **Step 4: Run the check script to verify it passes**

Run: `npx tsx scripts/check-home-logic.ts`
Expected: every line prints `ok - ...` and the script ends with `All home logic checks passed.` and exit code 0.

- [ ] **Step 5: Commit**

```bash
git add src/lib/home.ts scripts/check-home-logic.ts
git commit -m "feat: add pure home-page selection and attention logic"
```

---

### Task 2: Attention section component

**Files:**
- Create: `src/components/home/attention-section.tsx`

**Interfaces:**
- Consumes: `AttentionCounts` type from `@/lib/home` (Task 1).
- Produces: `export function AttentionSection({ counts }: { counts: AttentionCounts })` — a server-renderable component used by Task 5.

- [ ] **Step 1: Implement the component**

```tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AttentionCounts } from "@/lib/home";

const ATTENTION_ITEMS: {
  key: keyof AttentionCounts;
  emoji: string;
  label: (count: number) => string;
  query: string;
}[] = [
  {
    key: "missingContext",
    emoji: "⚠",
    label: (n) => `${n} Missing Context`,
    query: "missing_context",
  },
  {
    key: "blocked",
    emoji: "🚧",
    label: (n) => `${n} Blocked`,
    query: "blocked",
  },
  {
    key: "uiReadyForDev",
    emoji: "🎨",
    label: (n) => `${n} UI Ready for Dev`,
    query: "ui_ready",
  },
];

export function AttentionSection({ counts }: { counts: AttentionCounts }) {
  return (
    <Card className="border-black/5 bg-white/80">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">Attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {ATTENTION_ITEMS.map((item) => (
          <Link
            key={item.key}
            href={`/app/tasks?attention=${item.query}`}
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-900/5"
          >
            <span aria-hidden>{item.emoji}</span>
            <span>{item.label(counts[item.key])}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `attention-section.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/attention-section.tsx
git commit -m "feat: add Attention section component"
```

---

### Task 3: Team section component

**Files:**
- Create: `src/components/home/team-section.tsx`

**Interfaces:**
- Consumes: `HomeTask`, `pickCurrentTask` from `@/lib/home` (Task 1).
- Produces: `export type TeamMemberRow = { id: string; name: string; role: "pm" | "ui" | "dev"; tasks: HomeTask[] }` and `export function TeamSection({ members }: { members: TeamMemberRow[] })` — used by Task 5.

- [ ] **Step 1: Implement the component**

```tsx
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { pickCurrentTask, type HomeTask } from "@/lib/home";

export type TeamMemberRow = {
  id: string;
  name: string;
  role: "pm" | "ui" | "dev";
  tasks: HomeTask[];
};

export function TeamSection({ members }: { members: TeamMemberRow[] }) {
  return (
    <Card className="border-black/5 bg-white/80">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">Team</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {members.map((member) => {
          const { task, extraCount } = pickCurrentTask(member.tasks);
          return (
            <div
              key={member.id}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900">{member.name}</span>
                <Badge variant="outline" className="uppercase">
                  {member.role}
                </Badge>
              </div>
              <div className="text-slate-600">
                {task ? (
                  <span className="flex items-center gap-1">
                    <span aria-hidden>→</span>
                    <Link href={`/app/tasks/${task.id}`} className="hover:underline">
                      {task.title}
                    </Link>
                    {extraCount > 0 ? (
                      <span className="text-xs text-slate-400">+{extraCount} more</span>
                    ) : null}
                  </span>
                ) : (
                  <span className="text-slate-400">No active task</span>
                )}
              </div>
            </div>
          );
        })}
        {members.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">No team members yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `team-section.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/team-section.tsx
git commit -m "feat: add Team section component"
```

---

### Task 4: My Work section component

**Files:**
- Create: `src/components/home/my-work-section.tsx`

**Interfaces:**
- Consumes: `HomeTask`, `isOpenStatus` from `@/lib/home` (Task 1); `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `@/components/ui/tabs`.
- Produces: `export function MyWorkSection({ tasks }: { tasks: HomeTask[] })` — client component, used by Task 5. `tasks` is already scoped by caller (all team tasks for `pm`, own tasks otherwise — Task 5's responsibility).

- [ ] **Step 1: Implement the component**

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TASK_STATUS_LABEL, type TaskStatusValue } from "@/lib/task-constants";
import { isOpenStatus, type HomeTask } from "@/lib/home";

const STATUS_DOT: Record<TaskStatusValue, string> = {
  blocked: "🔴",
  working: "🟢",
  ready: "🟡",
  assigned: "🟡",
  not_ready: "⚪",
  review: "🔵",
  done: "✅",
};

type FilterKey = "all" | "active" | "done";

function matchesFilter(task: HomeTask, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "done") return task.status === "done";
  return isOpenStatus(task.status);
}

function TaskList({ tasks }: { tasks: HomeTask[] }) {
  if (tasks.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-500">Nothing here.</p>;
  }
  return (
    <ul className="divide-y divide-black/5">
      {tasks.map((task) => (
        <li key={task.id} className="flex items-center gap-2 py-2 text-sm">
          <span aria-hidden>{STATUS_DOT[task.status]}</span>
          <Link href={`/app/tasks/${task.id}`} className="flex-1 font-medium hover:underline">
            {task.title}
          </Link>
          <span className="text-xs text-slate-500">{TASK_STATUS_LABEL[task.status]}</span>
        </li>
      ))}
    </ul>
  );
}

export function MyWorkSection({ tasks }: { tasks: HomeTask[] }) {
  const [filter, setFilter] = useState<FilterKey>("active");

  const filtered = useMemo(
    () => tasks.filter((t) => matchesFilter(t, filter)),
    [tasks, filter],
  );

  return (
    <Card className="border-black/5 bg-white/80">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">My Work</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterKey)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="done">Done</TabsTrigger>
          </TabsList>
          <TabsContent value={filter}>
            <TaskList tasks={filtered} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `my-work-section.tsx`. If `Tabs`'s `onValueChange` prop name differs from `@base-ui/react/tabs`'s actual API, fix the prop name to match (check `src/components/ui/tabs.tsx`'s re-exported `TabsPrimitive.Root.Props` type via `npx tsc --noEmit` output — it will name the correct prop).

- [ ] **Step 3: Commit**

```bash
git add src/components/home/my-work-section.tsx
git commit -m "feat: add My Work section component with status tabs"
```

---

### Task 5: Wire up the home page

**Files:**
- Modify: `src/app/app/page.tsx` (full rewrite of the body — see below)

**Interfaces:**
- Consumes: `HomeTask`, `computeAttentionCounts` from `@/lib/home`; `AttentionSection` from Task 2; `TeamSection`, `TeamMemberRow` from Task 3; `MyWorkSection` from Task 4.
- Produces: nothing further downstream — this is the final integration point.

- [ ] **Step 1: Replace `src/app/app/page.tsx`**

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { MyWorkSection } from "@/components/home/my-work-section";
import { TeamSection, type TeamMemberRow } from "@/components/home/team-section";
import { AttentionSection } from "@/components/home/attention-section";
import { computeAttentionCounts, type HomeTask } from "@/lib/home";

export default async function AppHomePage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  });
  if (!membership) redirect("/onboarding");

  const [tasks, memberships] = await Promise.all([
    prisma.task.findMany({
      where: { teamId: membership.teamId },
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
    prisma.membership.findMany({
      where: { teamId: membership.teamId },
      include: { user: true },
    }),
  ]);

  const homeTasks: HomeTask[] = tasks;

  const myWorkTasks =
    membership.role === "pm"
      ? homeTasks
      : homeTasks.filter((t) => t.assigneeId === session.user.id);

  const teamMembers: TeamMemberRow[] = memberships.map((m) => ({
    id: m.userId,
    name: m.user.name,
    role: m.role,
    tasks: homeTasks.filter((t) => t.assigneeId === m.userId),
  }));

  const attentionCounts = computeAttentionCounts(homeTasks);

  return (
    <AppShell teamName={membership.team.name} role={membership.role}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">TeamHub</h1>
          <p className="text-sm text-slate-600">
            Who owns what vs who is working — Assigned ≠ Working.
          </p>
        </div>
        <MyWorkSection tasks={myWorkTasks} />
        <TeamSection members={teamMembers} />
        <AttentionSection counts={attentionCounts} />
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. If Prisma's generated `status`/`priority` field types are branded enum types rather than the plain string-union `TaskStatusValue`/`TaskPriorityValue` from `task-constants.ts`, the `const homeTasks: HomeTask[] = tasks;` assignment will fail — in that case add `as HomeTask[]` there (Prisma enums are structurally compatible string unions, so this is a safe assertion, not a type escape hatch for wrong data).

- [ ] **Step 3: Manual verification**

Run: `pnpm dev`

Then in the browser:
- Sign in as a `pm`-role user: confirm My Work's "Active" tab shows every team task, not just tasks assigned to that user.
- Sign in as a `dev` or `ui`-role user: confirm My Work shows only tasks assigned to them.
- Confirm the Team section shows one row per member, with `→ <task title>` for whoever has an open task, "No active task" for anyone without one, and `+N more` when a member has multiple open tasks.
- Confirm Attention's three counts match manually-counted values from `/app/tasks` for the same team, and that each links to `/app/tasks?attention=...`.
- Confirm the old stat-card grid (Tasks / Ready-Assigned / Working / Doc chunks / Context runs) no longer appears anywhere on `/app`.

- [ ] **Step 4: Commit**

```bash
git add src/app/app/page.tsx
git commit -m "feat: rebuild home page around My Work, Team, and Attention"
```
