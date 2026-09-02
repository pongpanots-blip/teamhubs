"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { SprintOption } from "@/components/tasks/sprint-select";

const ERROR_MESSAGES: Record<string, string> = {
  TITLE_OR_INTENT_REQUIRED: "Give the task a title",
};

const BACKLOG = "__backlog";

/**
 * The fast path for a task whose scope is already clear — skips the Grill
 * interview and posts straight to the API. Grilling stays the way in for
 * anything that needs the AI to pull requirement/AC/rules out of a PM.
 */
export function QuickTaskDialog({
  projectSlug,
  sprints,
  trigger,
  open,
  onOpenChange,
}: {
  projectSlug: string;
  sprints: SprintOption[];
  /** Omit when this dialog is opened externally (e.g. from a menu item). */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriorityValue>("p2");
  const [sprintId, setSprintId] = useState(BACKLOG);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle("");
    setDescription("");
    setPriority("p2");
    setSprintId(BACKLOG);
    setError(null);
  }

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
          body: JSON.stringify({ title, description, priority }),
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
      reset();
      onOpenChange?.(false);
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange?.(next);
        if (!next) reset();
      }}
    >
      {trigger}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New task</DialogTitle>
          <DialogDescription>
            For work whose scope is already clear. Need help pulling out
            requirements? Use Grill with AI instead.
          </DialogDescription>
        </DialogHeader>

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

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              Create task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
