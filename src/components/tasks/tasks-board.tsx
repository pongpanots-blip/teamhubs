"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TaskStatusBadge } from "@/components/tasks/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TASK_PRIORITY_SHORT_LABEL,
  TASK_STATUSES,
  type TaskPriorityValue,
  type TaskStatusValue,
  TASK_STATUS_COLUMN_LABEL,
} from "@/lib/task-constants";
import { taskStatusStyle } from "@/lib/task-status-style";
import { DEPLOY_STATE_LABEL, DEPLOY_STATE_STYLE, deployState } from "@/lib/deploy-state";
import { projectTask, projectTaskNew } from "@/lib/routes";

const PRIORITY_DOT_COLOR: Record<TaskPriorityValue, string> = {
  p0: "oklch(0.577 0.245 27.325)",
  p1: "oklch(0.62 0.15 70)",
  p2: "oklch(0.55 0.05 240)",
  p3: "var(--muted-foreground)",
};

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  deadline: string | Date | null;
  readinessScore: number;
  readinessNotes: string;
  assignee?: { name: string } | null;
  dependsOn: { dependency: { id: string; title: string; status: string } }[];
};


/**
 * Quick filters from the Task List artboard. "Missing context" and "Ready for
 * dev" are just the two statuses the engine sets — no separate flag exists.
 */
const CHIP_FILTERS: {
  status: TaskStatusValue | "all";
  label: string;
  tint: { color: string; borderColor: string; backgroundColor: string } | undefined;
}[] = [
  { status: "all", label: "All", tint: { color: "var(--muted-foreground)", borderColor: "var(--border)", backgroundColor: "var(--card)" } },
  {
    status: "blocked",
    label: "🚧 Blocked",
    tint: { color: "var(--st-blocked)", borderColor: "oklch(0.577 0.245 27.325 / 0.3)", backgroundColor: "var(--st-blocked-bg)" },
  },
  {
    status: "not_ready",
    label: "⚠ Missing context",
    tint: { color: "oklch(0.5 0.13 70)", borderColor: "oklch(0.62 0.15 70 / 0.4)", backgroundColor: "oklch(0.62 0.15 70 / 0.08)" },
  },
  {
    status: "ready",
    label: "🎨 Ready for dev",
    tint: { color: "var(--muted-foreground)", borderColor: "var(--border)", backgroundColor: "var(--card)" },
  },
];

/** Column widths from the "IntrovertHubs UI Mockups" Task List artboard. */
const ROW_GRID =
  "grid grid-cols-[2.1fr_0.8fr_0.85fr_0.75fr_0.85fr_0.95fr_1.1fr] items-center gap-2.5";

export function TasksBoard({
  initialTasks,
  projectName,
  currentProjectSlug,
}: {
  initialTasks: TaskRow[];
  projectName: string;
  currentProjectSlug: string;
}) {
  const tasks = initialTasks;
  const [view, setView] = useState<"list" | "board">("list");
  const [statusFilter, setStatusFilter] = useState<TaskStatusValue | "all">("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const sorted = useMemo(
    () =>
      [...tasks].sort((a, b) => {
        if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
        return b.readinessScore - a.readinessScore;
      }),
    [tasks],
  );

  const assigneeOptions = useMemo(
    () => Array.from(new Set(sorted.map((t) => t.assignee?.name).filter((n): n is string => !!n))),
    [sorted],
  );

  const filtered = useMemo(
    () =>
      sorted.filter(
        (t) =>
          (statusFilter === "all" || t.status === statusFilter) &&
          (assigneeFilter === "all" || t.assignee?.name === assigneeFilter),
      ),
    [sorted, statusFilter, assigneeFilter],
  );











  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight">Tasks</h1>
        <Button nativeButton={false} render={<Link href={projectTaskNew(currentProjectSlug)} />}>+ New task</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {CHIP_FILTERS.map((chip) => {
          const count =
            chip.status === "all" ? sorted.length : sorted.filter((t) => t.status === chip.status).length;
          if (chip.status !== "all" && count === 0) return null;
          const active = statusFilter === chip.status;
          return (
            <button
              key={chip.status}
              type="button"
              onClick={() =>
                setStatusFilter((f) => (chip.status !== "all" && f === chip.status ? "all" : chip.status))
              }
              className="rounded-full border px-2.5 py-[5px] text-xs font-medium"
              style={
                active
                  ? { backgroundColor: "var(--primary)", color: "var(--primary-foreground)", borderColor: "var(--primary)" }
                  : chip.tint
              }
            >
              {chip.label} ({count})
            </button>
          );
        })}
        <span className="mx-0.5 h-5 w-px bg-border" />
        <Select value={assigneeFilter} onValueChange={(v) => v && setAssigneeFilter(v)}>
          <SelectTrigger className="h-[26px] rounded-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Assignee: All</SelectItem>
            {assigneeOptions.map((name) => (
              <SelectItem key={name} value={name}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-semibold tracking-wide text-foreground uppercase">
                    {TASK_STATUS_COLUMN_LABEL[s]}
                  </span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{columnTasks.length}</span>
                </div>
                <div
                  className={`flex flex-col gap-2 ${s === "blocked" ? "-mx-1.5 rounded-lg p-1.5" : ""}`}
                  style={s === "blocked" ? { backgroundColor: "var(--st-blocked-bg)" } : undefined}
                >
                  {columnTasks.map((t) => (
                    <Link
                      key={t.id}
                      href={projectTask(currentProjectSlug, t.id)}
                      className="block rounded-[10px] bg-card px-3 py-2.5 ring-1 ring-foreground/[0.07]"
                    >
                      {t.dependsOn.length > 0 ? (
                        <span
                          className="mb-1.5 inline-flex h-[17px] items-center rounded-full px-1.5 text-[10px] font-medium"
                          style={{ backgroundColor: "oklch(0.52 0.14 300 / 0.1)", color: "oklch(0.46 0.14 300)" }}
                        >
                          🔍 part of {t.dependsOn.length} sub-tasks
                        </span>
                      ) : null}
                      <p className="mb-2 text-[12.5px] font-medium leading-snug">{t.title}</p>
                      <div className="flex items-center gap-2">
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: PRIORITY_DOT_COLOR[t.priority] }}
                        />
                        <span className="text-[11px] text-muted-foreground">
                          {t.deadline ? new Date(t.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                        </span>
                        <span className="ml-auto flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                          {t.assignee?.name?.[0]?.toUpperCase() ?? "?"}
                        </span>
                      </div>
                      <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-foreground"
                          style={{ width: `${t.readinessScore}%` }}
                        />
                      </div>
                      <span
                        className="mt-[7px] inline-flex h-[18px] items-center gap-1 rounded-full px-[7px] text-[10.5px] font-medium"
                        style={{
                          backgroundColor: DEPLOY_STATE_STYLE[deployState(t.status)].bg,
                          color: DEPLOY_STATE_STYLE[deployState(t.status)].color,
                        }}
                      >
                        {DEPLOY_STATE_LABEL[deployState(t.status)]}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
      <div className="overflow-hidden rounded-[14px] bg-card ring-1 ring-foreground/[0.08]">
        <div className={`${ROW_GRID} border-b border-border px-5 py-3 text-[11px] tracking-[0.05em] text-muted-foreground uppercase`}>
          <div>Task</div>
          <div>Owner</div>
          <div>Priority</div>
          <div>Deadline</div>
          <div>Readiness</div>
          <div>Deploy</div>
          <div>Status</div>
        </div>
        {filtered.map((t) => {
          const deploy = deployState(t.status);
          const deployStyle = DEPLOY_STATE_STYLE[deploy];
          return (
            <div
              key={t.id}
              className={`${ROW_GRID} border-t border-border px-5 py-3.5 first:border-t-0`}
            >
              <div className="min-w-0">
                <Link
                  href={projectTask(currentProjectSlug, t.id)}
                  className="text-[13px] font-medium hover:underline"
                >
                  {t.title}
                </Link>
                <div className="mt-0.5 text-xs text-muted-foreground">{projectName}</div>
                {t.dependsOn.length > 0 ? (
                  <span
                    className="mt-1 inline-flex h-[18px] items-center gap-1 rounded-full px-[7px] text-[10.5px] font-medium"
                    style={{ backgroundColor: "oklch(0.52 0.14 300 / 0.1)", color: "oklch(0.46 0.14 300)" }}
                  >
                    🔍 part of {t.dependsOn.length} sub-tasks
                  </span>
                ) : null}
              </div>
              <div className="truncate text-[13px]">
                {t.assignee?.name ?? <span className="text-muted-foreground">Unassigned</span>}
              </div>
              <div className="flex items-center text-[13px]">
                <span
                  className="mr-1.5 size-[7px] shrink-0 rounded-full"
                  style={{ backgroundColor: PRIORITY_DOT_COLOR[t.priority] }}
                />
                {TASK_PRIORITY_SHORT_LABEL[t.priority]}
              </div>
              <div className="text-[13px]">
                {t.deadline
                  ? new Date(t.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })
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
                  className="inline-flex h-5 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap"
                  style={{ backgroundColor: deployStyle.bg, color: deployStyle.color }}
                >
                  {DEPLOY_STATE_LABEL[deploy]}
                </span>
              </div>
              <div>
                <TaskStatusBadge status={t.status} />
              </div>
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Paste a free-form intent — IntrovertHubs builds BusinessRules[] dynamically.
          </p>
        ) : null}
      </div>
      )}
    </div>
  );
}
