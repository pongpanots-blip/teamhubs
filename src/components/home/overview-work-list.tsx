import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export type OverviewTask = HomeTask & { projectSlug: string };

/**
 * My open work across every project, in the same priority-then-deadline order
 * the per-project home uses, so "what's next" reads the same in both places.
 */
export function OverviewWorkList({ tasks }: { tasks: OverviewTask[] }) {
  const ordered = [...tasks].sort((a, b) => {
    // pickCurrentTask encodes the ordering rule; reuse it pairwise.
    const first = pickCurrentTask([a, b]).task;
    return first?.id === a.id ? -1 : 1;
  });

  return (
    <Card className="border-black/5 bg-white/80">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-slate-900">
          My Work · all projects
        </CardTitle>
      </CardHeader>
      <CardContent>
        {ordered.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">Nothing assigned to you.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {ordered.map((task) => (
              <li key={task.id} className="flex items-center gap-2 py-2 text-sm">
                <span aria-hidden>{STATUS_DOT[task.status]}</span>
                <Link
                  href={projectTask(task.projectSlug, task.id)}
                  className="flex-1 font-medium hover:underline"
                >
                  {task.title}
                </Link>
                <span className="text-xs text-slate-400">{task.projectSlug}</span>
                <span className="text-xs text-slate-500">{TASK_STATUS_LABEL[task.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
