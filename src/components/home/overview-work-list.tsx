"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_STATUS_LABEL, type TaskStatusValue } from "@/lib/task-constants";
import { pickCurrentTask, type HomeTask } from "@/lib/home";
import { projectTask } from "@/lib/routes";

const STATUS_DOT: Record<TaskStatusValue, string> = {
  blocked: "🔴",
  working: "🟢",
  ready: "🟡",
  assigned: "🟡",
  not_ready: "⚪",
  review: "🔵",
  done: "✅",
};

export type OverviewTask = HomeTask & { projectSlug: string; projectName: string };

const ALL_PROJECTS = "__all";

/** Priority-then-deadline order, matching pickCurrentTask's pairwise rule. */
function byPriority(tasks: OverviewTask[]): OverviewTask[] {
  return [...tasks].sort((a, b) => {
    const first = pickCurrentTask([a, b]).task;
    return first?.id === a.id ? -1 : 1;
  });
}

function TaskRow({ task, showProject }: { task: OverviewTask; showProject: boolean }) {
  return (
    <li className="flex items-center gap-2 py-2 text-sm">
      <span aria-hidden>{STATUS_DOT[task.status]}</span>
      <Link
        href={projectTask(task.projectSlug, task.id)}
        className="flex-1 truncate font-medium hover:underline"
      >
        {task.title}
      </Link>
      {showProject && (
        <span className="truncate text-xs text-muted-foreground/70">
          {task.projectName}
        </span>
      )}
      <span className="text-xs text-muted-foreground">{TASK_STATUS_LABEL[task.status]}</span>
    </li>
  );
}

/**
 * My open work across every project, in the same priority-then-deadline order
 * the per-project home uses, so "what's next" reads the same in both places.
 * "Group by project" mirrors Jira's board grouping — flat by default, one
 * section per project when you need to see where the work is concentrated.
 */
export function OverviewWorkList({ tasks }: { tasks: OverviewTask[] }) {
  const [projectFilter, setProjectFilter] = useState(ALL_PROJECTS);
  const [groupByProject, setGroupByProject] = useState(false);

  const projectOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of tasks) seen.set(t.projectSlug, t.projectName);
    return Array.from(seen, ([slug, name]) => ({ slug, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [tasks]);

  const filtered =
    projectFilter === ALL_PROJECTS
      ? tasks
      : tasks.filter((t) => t.projectSlug === projectFilter);

  const groups = useMemo(() => {
    if (!groupByProject) return [{ projectName: null as string | null, tasks: byPriority(filtered) }];
    const byProject = new Map<string, OverviewTask[]>();
    for (const t of filtered) {
      const list = byProject.get(t.projectSlug) ?? [];
      list.push(t);
      byProject.set(t.projectSlug, list);
    }
    return Array.from(byProject, ([, list]) => ({
      projectName: list[0].projectName,
      tasks: byPriority(list),
    })).sort((a, b) => (a.projectName ?? "").localeCompare(b.projectName ?? ""));
  }, [filtered, groupByProject]);

  return (
    <Card className="border-border bg-card/80">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="font-semibold text-foreground">
            My Work · all projects
          </CardTitle>
          {projectOptions.length > 0 && (
            <div className="flex items-center gap-2">
              <Select value={projectFilter} onValueChange={(v) => v && setProjectFilter(v)}>
                <SelectTrigger className="h-7 rounded-lg text-xs" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_PROJECTS}>All projects</SelectItem>
                  {projectOptions.map((p) => (
                    <SelectItem key={p.slug} value={p.slug}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <button
                type="button"
                aria-pressed={groupByProject}
                onClick={() => setGroupByProject((v) => !v)}
                className={`h-7 shrink-0 rounded-lg border px-2.5 text-xs transition-colors ${
                  groupByProject
                    ? "border-transparent bg-foreground/[0.08] font-medium"
                    : "border-dashed border-foreground/20 text-muted-foreground"
                }`}
              >
                Group by project
              </button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nothing assigned to you.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.projectName ?? "flat"}>
                {group.projectName !== null && (
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    {group.projectName}
                    <span className="ml-1.5 font-normal normal-case text-muted-foreground/70">
                      {group.tasks.length}
                    </span>
                  </p>
                )}
                <ul className="divide-y divide-black/5">
                  {group.tasks.map((task) => (
                    <TaskRow key={task.id} task={task} showProject={group.projectName === null} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
