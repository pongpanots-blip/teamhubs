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
