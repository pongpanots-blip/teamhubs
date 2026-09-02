"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TASK_PRIORITIES, TASK_PRIORITY_LABEL, type TaskPriorityValue } from "@/lib/task-constants";
import { projectTask } from "@/lib/routes";
import type { SprintOption } from "@/components/tasks/sprint-select";

const ERROR_MESSAGES: Record<string, string> = {
  TITLE_OR_INTENT_REQUIRED: "Give the task a title",
};

const BACKLOG = "__backlog";
const UNASSIGNED = "__unassigned";

export type QuickTaskMember = { id: string; name: string };

/**
 * The fields + submit logic for the fast path: a task whose scope is already
 * clear, created without the Grill interview. Shared by the dialog (task
 * list "+ New task" menu) and the inline "กรอกฟอร์มเร็ว" tab on the new-task
 * page — one place owns what "create a task quickly" means.
 */
export function QuickTaskForm({
  projectSlug,
  sprints,
  members,
  onCreated,
}: {
  projectSlug: string;
  sprints: SprintOption[];
  members: QuickTaskMember[];
  /** Called with the created task's id. Defaults to navigating to the task's own page. */
  onCreated?: (taskId: string) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriorityValue>("p2");
  const [sprintId, setSprintId] = useState(BACKLOG);
  const [assigneeId, setAssigneeId] = useState(UNASSIGNED);
  const [deadline, setDeadline] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError(ERROR_MESSAGES.TITLE_OR_INTENT_REQUIRED);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tasks?project=${encodeURIComponent(projectSlug)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description,
            priority,
            assigneeId: assigneeId === UNASSIGNED ? null : assigneeId,
            deadline: deadline ? new Date(deadline).toISOString() : null,
          }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const code = data.error ?? "Request failed";
        setError(ERROR_MESSAGES[code] ?? code);
        return;
      }
      const { task } = (await res.json()) as { task: { id: string } };
      if (sprintId !== BACKLOG) {
        await fetch(`/api/tasks/${task.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sprintId }),
        });
      }
      if (onCreated) {
        onCreated(task.id);
      } else {
        router.push(projectTask(projectSlug, task.id));
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={create} className="space-y-3">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="space-y-1">
        <Label htmlFor="quick-task-title">Title</Label>
        <Input
          id="quick-task-title"
          autoFocus
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Fix pagination bug on invoice list"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="quick-task-priority">Priority</Label>
          <Select
            value={priority}
            onValueChange={(v) => setPriority(v as TaskPriorityValue)}
          >
            <SelectTrigger id="quick-task-priority">
              <SelectValue>
                {(value: TaskPriorityValue) => TASK_PRIORITY_LABEL[value]}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {TASK_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {TASK_PRIORITY_LABEL[p]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="quick-task-sprint">Sprint</Label>
          <select
            id="quick-task-sprint"
            value={sprintId}
            onChange={(e) => setSprintId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
          >
            <option value={BACKLOG}>Backlog</option>
            {sprints
              .filter((s) => !s.isClosed)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="quick-task-assignee">Assignee</Label>
          <select
            id="quick-task-assignee"
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
          >
            <option value={UNASSIGNED}>Unassigned</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="quick-task-deadline">Deadline</Label>
          <Input
            id="quick-task-deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="quick-task-description">Description</Label>
        <Textarea
          id="quick-task-description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What needs to happen"
        />
      </div>

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create task"}
        </Button>
      </div>
    </form>
  );
}
