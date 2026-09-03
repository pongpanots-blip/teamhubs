"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  TASK_STATUSES,
  TASK_STATUS_LABEL,
  type TaskStatusValue,
} from "@/lib/task-constants";
import { taskStatusStyle } from "@/lib/task-status-style";

/** Interactive status pill for the task detail header — PATCHes the task and refreshes. */
export function StatusSelect({ taskId, status }: { taskId: string; status: TaskStatusValue }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const { color, bg } = taskStatusStyle(status);

  return (
    <select
      value={status}
      disabled={pending}
      onChange={async (e) => {
        const next = e.target.value as TaskStatusValue;
        setPending(true);
        try {
          await fetch(`/api/tasks/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: next }),
          });
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
      className="h-8 shrink-0 rounded-lg border-0 px-2.5 text-xs font-medium disabled:opacity-60"
      style={{ backgroundColor: bg, color }}
    >
      {TASK_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TASK_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
