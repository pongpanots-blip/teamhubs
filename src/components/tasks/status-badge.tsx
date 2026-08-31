import { TASK_STATUS_LABEL, type TaskStatusValue } from "@/lib/task-constants";
import { taskStatusStyle } from "@/lib/task-status-style";

/** Dot + colored pill per status, matching the "IntrovertHubs UI Mockups" design canvas. */
export function TaskStatusBadge({ status }: { status: TaskStatusValue }) {
  const { color, bg } = taskStatusStyle(status);
  return (
    <span
      className="inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap"
      style={{ backgroundColor: bg, color }}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {TASK_STATUS_LABEL[status]}
    </span>
  );
}
