"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/tasks/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_SHORT_LABEL,
  TASK_STATUSES,
  type TaskPriorityValue,
  type TaskStatusValue,
  TASK_STATUS_COLUMN_LABEL,
  TASK_COMPONENTS,
  TASK_COMPONENT_LABEL,
  type TaskComponentValue,
} from "@/lib/task-constants";
import { taskStatusStyle } from "@/lib/task-status-style";
import { avatarColor } from "@/lib/avatar-color";
import {
  DEPLOY_STATE_LABEL,
  DEPLOY_STATE_STYLE,
  deployState,
} from "@/lib/deploy-state";
import { projectTask, projectTaskNew } from "@/lib/routes";
import {
  SprintPicker,
  type SprintOption,
} from "@/components/tasks/sprint-select";
import { QuickTaskDialog } from "@/components/tasks/quick-task-dialog";
import type { QuickTaskMember } from "@/components/tasks/quick-task-form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FilePlus, MessageCircle } from "lucide-react";

const PRIORITY_DOT_COLOR: Record<TaskPriorityValue, string> = {
  p0: "var(--destructive)",
  p1: "var(--st-working)",
  p2: "oklch(0.55 0.05 240)",
  p3: "var(--muted-foreground)",
};

/** Small filled triangle for priority — the board-card glyph, key+priority share the top row. */
function PriorityGlyph({ priority }: { priority: TaskPriorityValue }) {
  return (
    <svg
      viewBox="0 0 12 12"
      className="size-2.5 shrink-0"
      aria-hidden="true"
    >
      <path d="M6 1.5 L10.5 10 L1.5 10 Z" fill={PRIORITY_DOT_COLOR[priority]} />
    </svg>
  );
}

/** One accent color per component — the "epic tag" chip on list rows and board cards. */
const COMPONENT_TAG_COLOR: Record<TaskComponentValue, { color: string; bg: string }> = {
  ui: { color: "var(--violet)", bg: "var(--violet-bg)" },
  website: { color: "var(--st-ready)", bg: "var(--st-ready-bg)" },
  backend: { color: "var(--st-review)", bg: "var(--st-review-bg)" },
  mobile: { color: "var(--st-working-strong)", bg: "var(--st-working-bg)" },
  ai: { color: "var(--st-done)", bg: "var(--st-done-bg)" },
};

function ComponentTag({ component }: { component: TaskComponentValue }) {
  const { color, bg } = COMPONENT_TAG_COLOR[component];
  return (
    <span
      className="inline-flex h-[18px] shrink-0 items-center rounded-lg px-[7px] text-micro font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      {TASK_COMPONENT_LABEL[component]}
    </span>
  );
}

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  deadline: string | Date | null;
  readinessScore: number;
  readinessNotes: string;
  assignee?: { name: string } | null;
  sprintId: string | null;
  estimateHours: number | null;
  actualHours: number | null;
  dependsOn: { dependency: { id: string; title: string; status: string } }[];
  /** Its sub-tasks — shown nested under this task's row/card, not counted from dependsOn. */
  subTasks: { id: string; title: string; status: TaskStatusValue }[];
  /** Business days the card has sat in its current status. Null with no history yet. */
  daysInStatus: number | null;
  /** Set on a component sub-task; null on a parent/container task. */
  component: TaskComponentValue | null;
  /** Human-facing "CHK-142" key; null on tasks created before this existed. */
  taskKey: string | null;
};

/** Business days in the current column before the card counts as stuck. */
const STAGNANT_THRESHOLD_DAYS = 3;

/**
 * Graduated dots for how long a card has sat in its current column — same
 * idea as the readiness bar: glance, don't read. One dot lights per threshold
 * crossed (3 / 7 / 14 business days), amber then red.
 */
function ColumnAgeDots({ days }: { days: number | null }) {
  if (days === null || days < STAGNANT_THRESHOLD_DAYS) return null;
  const level = days >= 14 ? 3 : days >= 7 ? 2 : 1;
  const color = level >= 3 ? "var(--destructive)" : "var(--st-working)";
  return (
    <span
      className="flex items-center gap-1"
      title={`${days} business day${days === 1 ? "" : "s"} in this column`}
    >
      {[1, 2, 3].map((dot) => (
        <span
          key={dot}
          className="size-[5px] shrink-0 rounded-full"
          style={{
            backgroundColor: dot <= level ? color : "var(--muted)",
          }}
        />
      ))}
    </span>
  );
}

/**
 * Quick filters from the Task List artboard. "Missing context" and "Ready for
 * dev" are just the two statuses the engine sets — no separate flag exists.
 */
const CHIP_FILTERS: {
  status: TaskStatusValue | "all";
  label: string;
  tint:
    { color: string; borderColor: string; backgroundColor: string } | undefined;
}[] = [
  {
    status: "all",
    label: "All",
    tint: {
      color: "var(--muted-foreground)",
      borderColor: "var(--border)",
      backgroundColor: "var(--card)",
    },
  },
  {
    status: "blocked",
    label: "🚧 Blocked",
    tint: {
      color: "var(--st-blocked)",
      borderColor: "oklch(0.577 0.245 27.325 / 0.3)",
      backgroundColor: "var(--st-blocked-bg)",
    },
  },
  {
    status: "not_ready",
    label: "⚠ Missing context",
    tint: {
      color: "var(--st-working-strong)",
      borderColor: "oklch(0.62 0.15 70 / 0.4)",
      backgroundColor: "oklch(0.62 0.15 70 / 0.08)",
    },
  },
  {
    status: "ready",
    label: "🎨 Ready for dev",
    tint: {
      color: "var(--muted-foreground)",
      borderColor: "var(--border)",
      backgroundColor: "var(--card)",
    },
  },
];

/** Column widths from the "IntrovertHubs UI Mockups" Task List artboard. */
const ROW_GRID =
  "grid grid-cols-[1.9fr_0.75fr_0.7fr_0.65fr_0.7fr_0.85fr_0.6fr_1fr_1fr] items-center gap-2.5";

/** "6/4h" — spent against planned. A dash until someone has sized the card. */
function formatHours(actual: number | null, estimate: number | null): string {
  if (actual === null && estimate === null) return "—";
  return `${actual ?? 0}/${estimate ?? 0}h`;
}

/** One list-view row, plus its nested sub-task rows — pulled out so both the
 * flat list and the grouped-by-X list can render it without duplicating this. */
function TaskListRow({
  t,
  projectName,
  currentProjectSlug,
  sprints,
}: {
  t: TaskRow;
  projectName: string;
  currentProjectSlug: string;
  sprints: SprintOption[];
}) {
  const deploy = deployState(t.status);
  const deployStyle = DEPLOY_STATE_STYLE[deploy];
  const hasSubTasks = t.subTasks.length > 0;
  return (
    <div className="border-t border-border first:border-t-0">
      <div className={`${ROW_GRID} px-5 py-3.5`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {t.component ? <ComponentTag component={t.component} /> : null}
            <Link
              href={projectTask(currentProjectSlug, t.id)}
              className={`truncate text-body hover:underline ${hasSubTasks ? "font-semibold" : "font-medium"}`}
            >
              {t.title}
            </Link>
            {hasSubTasks ? (
              <span
                className="inline-flex h-[18px] shrink-0 items-center gap-1 rounded-lg px-[7px] text-micro font-medium"
                style={{
                  backgroundColor: "var(--violet-bg)",
                  color: "var(--violet)",
                }}
              >
                ✶ {t.subTasks.length} sub-tasks
              </span>
            ) : null}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            {t.taskKey ? (
              <span className="font-mono text-muted-foreground/80">{t.taskKey}</span>
            ) : null}
            {projectName}
          </div>
        </div>
        <div className="flex min-w-0 items-center gap-2 text-body">
          <span
            className="flex size-6 shrink-0 items-center justify-center rounded-full text-micro font-semibold text-white"
            style={
              t.assignee?.name
                ? { backgroundColor: avatarColor(t.assignee.name) }
                : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }
            }
          >
            {t.assignee?.name?.[0]?.toUpperCase() ?? "?"}
          </span>
          <span className="truncate">
            {t.assignee?.name ?? (
              <span className="text-muted-foreground">Unassigned</span>
            )}
          </span>
        </div>
        <div className="flex items-center text-body">
          <span
            className="mr-1.5 size-[7px] shrink-0 rounded-full"
            style={{ backgroundColor: PRIORITY_DOT_COLOR[t.priority] }}
          />
          {TASK_PRIORITY_SHORT_LABEL[t.priority]}
        </div>
        <div className="text-body">
          {t.deadline
            ? new Date(t.deadline).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "—"}
        </div>
        <div>
          <div
            className="h-[5px] w-16 overflow-hidden rounded-full bg-muted"
            title={t.readinessNotes || `${t.readinessScore}%`}
          >
            <div
              className="h-full rounded-full bg-foreground"
              style={{ width: `${t.readinessScore}%` }}
            />
          </div>
        </div>
        <div>
          <span
            className="inline-flex h-5 items-center gap-1 rounded-lg px-2 text-meta font-medium whitespace-nowrap"
            style={{
              backgroundColor: deployStyle.bg,
              color: deployStyle.color,
            }}
          >
            {DEPLOY_STATE_LABEL[deploy]}
          </span>
        </div>
        <div
          className="text-body tabular-nums"
          title="Actual / estimated man hours"
        >
          {formatHours(t.actualHours, t.estimateHours)}
        </div>
        <div className="min-w-0">
          <SprintPicker
            taskId={t.id}
            sprintId={t.sprintId}
            sprints={sprints}
            className="w-full"
          />
        </div>
        <div>
          <TaskStatusBadge status={t.status} />
        </div>
      </div>
      {hasSubTasks ? (
        <div
          className="ml-[18px] flex flex-col gap-1 border-l-2 pb-3 pl-3.5"
          style={{ borderLeftColor: "var(--violet-bg)" }}
        >
          {t.subTasks.map((sub) => (
            <Link
              key={sub.id}
              href={projectTask(currentProjectSlug, sub.id)}
              className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs hover:underline"
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: taskStatusStyle(sub.status).color }}
              />
              <span className="min-w-0 flex-1 truncate">{sub.title}</span>
              <span className="shrink-0 text-muted-foreground">
                {TASK_STATUS_COLUMN_LABEL[sub.status]}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** "Group by" a list-view breakdown gives — one section per bucket, with a
 * stable, meaningful order rather than whatever object-key order falls out. */
type GroupByValue = "none" | "status" | "assignee" | "priority" | "sprint" | "component";

const GROUP_BY_LABEL: Record<GroupByValue, string> = {
  none: "None",
  status: "Status",
  assignee: "Assignee",
  priority: "Priority",
  sprint: "Sprint",
  component: "Component",
};

function groupTasks(
  tasks: TaskRow[],
  groupBy: GroupByValue,
  sprints: SprintOption[],
): { key: string; label: string; dotColor?: string; tasks: TaskRow[] }[] {
  if (groupBy === "none") return [{ key: "all", label: "", tasks }];

  const buckets = new Map<string, TaskRow[]>();
  for (const t of tasks) {
    const key =
      groupBy === "status"
        ? t.status
        : groupBy === "assignee"
          ? (t.assignee?.name ?? "__unassigned")
          : groupBy === "priority"
            ? t.priority
            : groupBy === "sprint"
              ? (t.sprintId ?? "__backlog")
              : (t.component ?? "__none");
    const bucket = buckets.get(key);
    if (bucket) bucket.push(t);
    else buckets.set(key, [t]);
  }

  if (groupBy === "status") {
    return TASK_STATUSES.filter((s) => buckets.has(s)).map((s) => ({
      key: s,
      label: TASK_STATUS_COLUMN_LABEL[s],
      dotColor: taskStatusStyle(s).color,
      tasks: buckets.get(s)!,
    }));
  }
  if (groupBy === "priority") {
    return TASK_PRIORITIES.filter((p) => buckets.has(p)).map((p) => ({
      key: p,
      label: TASK_PRIORITY_SHORT_LABEL[p],
      dotColor: PRIORITY_DOT_COLOR[p],
      tasks: buckets.get(p)!,
    }));
  }
  if (groupBy === "component") {
    const groups = TASK_COMPONENTS.filter((c) => buckets.has(c)).map((c) => ({
      key: c,
      label: TASK_COMPONENT_LABEL[c],
      dotColor: COMPONENT_TAG_COLOR[c].color,
      tasks: buckets.get(c)!,
    }));
    const none = buckets.get("__none");
    return none ? [...groups, { key: "__none", label: "No component", tasks: none }] : groups;
  }
  if (groupBy === "sprint") {
    const groups = sprints
      .filter((s) => buckets.has(s.id))
      .map((s) => ({ key: s.id, label: s.name, tasks: buckets.get(s.id)! }));
    const backlog = buckets.get("__backlog");
    return backlog ? [...groups, { key: "__backlog", label: "Backlog", tasks: backlog }] : groups;
  }
  // assignee — alphabetical, unassigned last.
  const names = [...buckets.keys()].filter((k) => k !== "__unassigned").sort();
  const groups = names.map((name) => ({ key: name, label: name, tasks: buckets.get(name)! }));
  const unassigned = buckets.get("__unassigned");
  return unassigned ? [...groups, { key: "__unassigned", label: "Unassigned", tasks: unassigned }] : groups;
}

export function TasksBoard({
  initialTasks,
  projectName,
  currentProjectSlug,
  sprints,
  members,
}: {
  initialTasks: TaskRow[];
  projectName: string;
  currentProjectSlug: string;
  sprints: SprintOption[];
  members: QuickTaskMember[];
}) {
  const tasks = initialTasks;
  const [view, setView] = useState<"list" | "board">("list");
  const [statusFilter, setStatusFilter] = useState<TaskStatusValue | "all">(
    "all",
  );
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState<TaskPriorityValue | "all">("all");
  const [sprintFilter, setSprintFilter] = useState<"all" | "backlog" | string>("all");
  const [stagnantOnly, setStagnantOnly] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByValue>("none");
  const [quickTaskOpen, setQuickTaskOpen] = useState(false);
  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.priority !== b.priority)
          return a.priority.localeCompare(b.priority);
        return b.readinessScore - a.readinessScore;
      }),
    [tasks],
  );

  const assigneeOptions = useMemo(
    () =>
      Array.from(
        new Set(
          sorted.map((t) => t.assignee?.name).filter((n): n is string => !!n),
        ),
      ),
    [sorted],
  );

  const filtered = useMemo(
    () =>
      sorted.filter(
        (t) =>
          (statusFilter === "all" || t.status === statusFilter) &&
          (assigneeFilter === "all" || t.assignee?.name === assigneeFilter) &&
          (priorityFilter === "all" || t.priority === priorityFilter) &&
          (sprintFilter === "all" ||
            (sprintFilter === "backlog" ? t.sprintId === null : t.sprintId === sprintFilter)) &&
          (!stagnantOnly ||
            (t.daysInStatus !== null &&
              t.daysInStatus >= STAGNANT_THRESHOLD_DAYS)),
      ),
    [sorted, statusFilter, assigneeFilter, priorityFilter, sprintFilter, stagnantOnly],
  );

  const groupedFiltered = useMemo(
    () => groupTasks(filtered, groupBy, sprints),
    [filtered, groupBy, sprints],
  );

  const activeFilterCount = [
    statusFilter !== "all",
    assigneeFilter !== "all",
    priorityFilter !== "all",
    sprintFilter !== "all",
    stagnantOnly,
  ].filter(Boolean).length;

  const stagnantCount = useMemo(
    () =>
      sorted.filter(
        (t) => t.daysInStatus !== null && t.daysInStatus >= STAGNANT_THRESHOLD_DAYS,
      ).length,
    [sorted],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-title font-semibold tracking-tight">Tasks</h1>
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({})}>
            + New task
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuItem onClick={() => setQuickTaskOpen(true)}>
              <FilePlus className="size-4" />
              <div>
                <p>Quick task</p>
                <p className="text-xs text-muted-foreground">
                  Fill a short form and create it now
                </p>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<Link href={projectTaskNew(currentProjectSlug)} />}
            >
              <MessageCircle className="size-4" />
              <div>
                <p>Grill with AI</p>
                <p className="text-xs text-muted-foreground">
                  Chat it out until the context is complete
                </p>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <QuickTaskDialog
          projectSlug={currentProjectSlug}
          sprints={sprints}
          members={members}
          open={quickTaskOpen}
          onOpenChange={setQuickTaskOpen}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CHIP_FILTERS.map((chip) => {
          const count =
            chip.status === "all"
              ? sorted.length
              : sorted.filter((t) => t.status === chip.status).length;
          if (chip.status !== "all" && count === 0) return null;
          const active = statusFilter === chip.status;
          return (
            <button
              key={chip.status}
              type="button"
              onClick={() =>
                setStatusFilter((f) =>
                  chip.status !== "all" && f === chip.status
                    ? "all"
                    : chip.status,
                )
              }
              className="rounded-lg border px-2.5 py-[5px] text-xs font-medium"
              style={
                active
                  ? {
                      backgroundColor: "var(--primary)",
                      color: "var(--primary-foreground)",
                      borderColor: "var(--primary)",
                    }
                  : chip.tint
              }
            >
              {chip.label} ({count})
            </button>
          );
        })}
        {stagnantCount > 0 || stagnantOnly ? (
          <button
            type="button"
            onClick={() => setStagnantOnly((v) => !v)}
            className="rounded-lg border px-2.5 py-[5px] text-xs font-medium"
            style={
              stagnantOnly
                ? {
                    backgroundColor: "var(--primary)",
                    color: "var(--primary-foreground)",
                    borderColor: "var(--primary)",
                  }
                : {
                    color: "var(--st-working-strong)",
                    borderColor: "oklch(0.62 0.15 70 / 0.4)",
                    backgroundColor: "oklch(0.62 0.15 70 / 0.08)",
                  }
            }
          >
            🐌 Stagnant ({stagnantCount})
          </button>
        ) : null}
        <span className="mx-0.5 h-5 w-px bg-border" />
        <Select
          value={statusFilter}
          onValueChange={(v) => v && setStatusFilter(v as TaskStatusValue | "all")}
        >
          <SelectTrigger className="h-[26px] rounded-lg text-xs">
            <SelectValue>
              {(v: TaskStatusValue | "all") =>
                `Status: ${v === "all" ? "All" : TASK_STATUS_COLUMN_LABEL[v]}`
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_COLUMN_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priorityFilter}
          onValueChange={(v) => v && setPriorityFilter(v as TaskPriorityValue | "all")}
        >
          <SelectTrigger className="h-[26px] rounded-lg text-xs">
            <SelectValue>
              {(v: TaskPriorityValue | "all") =>
                `Priority: ${v === "all" ? "All" : TASK_PRIORITY_SHORT_LABEL[v]}`
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {(["p0", "p1", "p2", "p3"] as const).map((p) => (
              <SelectItem key={p} value={p}>
                {TASK_PRIORITY_SHORT_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sprintFilter} onValueChange={(v) => v && setSprintFilter(v)}>
          <SelectTrigger className="h-[26px] rounded-lg text-xs">
            <SelectValue>
              {(v: string) => {
                const label =
                  v === "all" ? "All" : v === "backlog" ? "Backlog" : (sprints.find((s) => s.id === v)?.name ?? v);
                return `Sprint: ${label}`;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
            {sprints.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={assigneeFilter}
          onValueChange={(v) => v && setAssigneeFilter(v)}
        >
          <SelectTrigger className="h-[26px] rounded-lg text-xs">
            <SelectValue>{(v: string) => `Assignee: ${v === "all" ? "All" : v}`}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {assigneeOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {view === "list" ? (
          <>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <Select
              value={groupBy}
              onValueChange={(v) => v && setGroupBy(v as GroupByValue)}
            >
              <SelectTrigger className="h-[26px] rounded-lg text-xs">
                <SelectValue>
                  {(v: GroupByValue) => `Group by: ${GROUP_BY_LABEL[v]}`}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(GROUP_BY_LABEL) as GroupByValue[]).map((g) => (
                  <SelectItem key={g} value={g}>
                    {GROUP_BY_LABEL[g]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
        {activeFilterCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              setStatusFilter("all");
              setAssigneeFilter("all");
              setPriorityFilter("all");
              setSprintFilter("all");
              setStagnantOnly(false);
            }}
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Clear filters ({activeFilterCount})
          </button>
        ) : null}
        <div className="ml-auto inline-flex overflow-hidden rounded-lg ring-1 ring-border">
          <button
            type="button"
            onClick={() => setView("list")}
            className={`px-3.5 py-1.5 text-xs font-medium ${view === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            List
          </button>
          <button
            type="button"
            onClick={() => setView("board")}
            className={`px-3.5 py-1.5 text-xs font-medium ${view === "board" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
          >
            Board
          </button>
        </div>
      </div>

      {view === "board" ? (
        <div className="flex gap-3.5 overflow-x-auto pb-2">
          {TASK_STATUSES.map((s) => {
            const columnTasks = filtered.filter((t) => t.status === s);
            const { color } = taskStatusStyle(s);
            return (
              <div key={s} className="w-[232px] flex-none">
                <div className="mb-2.5 flex items-center gap-2 px-1">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
                    {TASK_STATUS_COLUMN_LABEL[s]}
                  </span>
                  <span className="ml-auto text-meta text-muted-foreground">
                    {columnTasks.length}
                  </span>
                </div>
                <div
                  className={`flex flex-col gap-2 ${s === "blocked" ? "-mx-1.5 rounded-lg p-1.5" : ""}`}
                  style={
                    s === "blocked"
                      ? { backgroundColor: "var(--st-blocked-bg)" }
                      : undefined
                  }
                >
                  {columnTasks.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-xl border-l-[3px] bg-card px-3.5 py-3 ring-1 ring-foreground/[0.07] transition-shadow hover:ring-foreground/[0.12]"
                      style={{ borderLeftColor: taskStatusStyle(t.status).color }}
                    >
                      <Link
                        href={projectTask(currentProjectSlug, t.id)}
                        className="block"
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <span className="font-mono text-micro text-muted-foreground">
                            {t.taskKey ?? " "}
                          </span>
                          <span title={`Priority: ${TASK_PRIORITY_SHORT_LABEL[t.priority]}`}>
                            <PriorityGlyph priority={t.priority} />
                          </span>
                        </div>
                        {t.component ? (
                          <div className="mb-1.5">
                            <ComponentTag component={t.component} />
                          </div>
                        ) : null}
                        {t.subTasks.length > 0 ? (
                          <span
                            className="mb-1.5 inline-flex h-[17px] items-center rounded-lg px-1.5 text-micro font-medium"
                            style={{
                              backgroundColor: "var(--violet-bg)",
                              color: "var(--violet)",
                            }}
                          >
                            ✶ {t.subTasks.length} sub-tasks
                          </span>
                        ) : null}
                        <p className="mb-2 text-body font-medium leading-snug">
                          {t.title}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="text-meta text-muted-foreground">
                            {t.deadline
                              ? new Date(t.deadline).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" },
                                )
                              : "—"}
                          </span>
                          {t.estimateHours !== null ||
                          t.actualHours !== null ? (
                            <span className="text-meta text-muted-foreground tabular-nums">
                              {formatHours(t.actualHours, t.estimateHours)}
                            </span>
                          ) : null}
                          <span className="ml-auto flex items-center gap-2">
                            <ColumnAgeDots days={t.daysInStatus} />
                            <span
                              className="flex size-5 shrink-0 items-center justify-center rounded-full text-micro font-semibold text-white"
                              style={
                                t.assignee?.name
                                  ? { backgroundColor: avatarColor(t.assignee.name) }
                                  : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }
                              }
                              title={t.assignee?.name ?? "Unassigned"}
                            >
                              {t.assignee?.name?.[0]?.toUpperCase() ?? "?"}
                            </span>
                          </span>
                        </div>
                        <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-foreground"
                            style={{ width: `${t.readinessScore}%` }}
                          />
                        </div>
                        <span
                          className="mt-[7px] inline-flex h-[18px] items-center gap-1 rounded-lg px-[7px] text-micro font-medium"
                          style={{
                            backgroundColor:
                              DEPLOY_STATE_STYLE[deployState(t.status)].bg,
                            color:
                              DEPLOY_STATE_STYLE[deployState(t.status)].color,
                          }}
                        >
                          {DEPLOY_STATE_LABEL[deployState(t.status)]}
                        </span>
                      </Link>
                      <SprintPicker
                        taskId={t.id}
                        sprintId={t.sprintId}
                        sprints={sprints}
                        className="mt-2 w-full"
                      />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[14px] bg-card ring-1 ring-foreground/[0.08]">
          <div
            className={`${ROW_GRID} border-b border-border px-5 py-3 text-meta tracking-[0.05em] text-muted-foreground uppercase`}
          >
            <div>Task</div>
            <div>Owner</div>
            <div>Priority</div>
            <div>Deadline</div>
            <div>Readiness</div>
            <div>Deploy</div>
            <div>Hours</div>
            <div>Sprint</div>
            <div>Status</div>
          </div>
          {groupedFiltered.map((group) => (
            <Fragment key={group.key}>
              {groupBy !== "none" ? (
                <div className="flex items-center gap-2 border-t border-border bg-muted/60 px-5 py-2 first:border-t-0">
                  {group.dotColor ? (
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: group.dotColor }}
                    />
                  ) : null}
                  <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
                    {group.label}
                  </span>
                  <span className="text-meta text-muted-foreground">
                    {group.tasks.length}
                  </span>
                </div>
              ) : null}
              {group.tasks.map((t) => (
                <TaskListRow
                  key={t.id}
                  t={t}
                  projectName={projectName}
                  currentProjectSlug={currentProjectSlug}
                  sprints={sprints}
                />
              ))}
            </Fragment>
          ))}
          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Paste a free-form intent — IntrovertHubs builds BusinessRules[]
              dynamically.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
