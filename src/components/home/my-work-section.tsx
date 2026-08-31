"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { TASK_STATUS_LABEL, type TaskStatusValue } from "@/lib/task-constants";
import { taskStatusStyle } from "@/lib/task-status-style";
import { isOpenStatus, type HomeTask } from "@/lib/home";
import { projectTask } from "@/lib/routes";

type FilterKey = "active" | "all" | "done";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "all", label: "All" },
  { key: "done", label: "Done" },
];

function matchesFilter(task: HomeTask, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter === "done") return task.status === "done";
  return isOpenStatus(task.status);
}

export function MyWorkSection({
  tasks,
  projectSlug,
}: {
  tasks: HomeTask[];
  projectSlug: string;
}) {
  const [filter, setFilter] = useState<FilterKey>("active");

  const filtered = useMemo(
    () => tasks.filter((t) => matchesFilter(t, filter)),
    [tasks, filter],
  );

  return (
    <section>
      <h2 className="mb-3 text-[15px] font-semibold">My Work</h2>
      <div className="rounded-[14px] bg-card/80 p-4 ring-1 ring-foreground/5">
        <div className="mb-3 flex gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-2.5 py-1 text-xs ${
                filter === f.key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Nothing here.</p>
        ) : (
          <div>
            {filtered.map((task, i) => (
              <div
                key={task.id}
                className={`flex items-center gap-2.5 py-2.5 text-sm ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: taskStatusStyle(task.status as TaskStatusValue).color }}
                />
                <Link href={projectTask(projectSlug, task.id)} className="flex-1 font-medium hover:underline">
                  {task.title}
                </Link>
                <span className="ml-auto text-xs text-muted-foreground">
                  {TASK_STATUS_LABEL[task.status]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
