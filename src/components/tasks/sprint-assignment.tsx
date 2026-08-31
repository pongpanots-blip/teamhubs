"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";

export type SprintOption = {
  id: string;
  name: string;
  /** Started and not yet closed — moving a card now is a logged scope change. */
  isActive: boolean;
  /** Already reported on. Only ever listed because the card is already in it. */
  isClosed: boolean;
};

const ERROR_MESSAGES: Record<string, string> = {
  SPRINT_NOT_IN_PROJECT: "That sprint belongs to another project",
  FORBIDDEN: "You do not have permission to change this card",
  NOT_FOUND: "This card no longer exists",
};

/**
 * Sprint membership and size, editable from the card itself — the two fields
 * every flow number downstream depends on, so they belong where the card is
 * being worked on and not only on the planning screen.
 */
export function SprintAssignment({
  taskId,
  sprintId,
  storyPoints,
  sprints,
}: {
  taskId: string;
  sprintId: string | null;
  storyPoints: number | null;
  sprints: SprintOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(body: { sprintId?: string | null; storyPoints?: number | null }) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const code = data.error ?? "Request failed";
        setError(ERROR_MESSAGES[code] ?? code);
        return;
      }
      router.refresh();
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const current = sprints.find((s) => s.id === sprintId);

  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`sprint-${taskId}`} className="text-sm text-muted-foreground">
          Sprint
        </label>
        <select
          id={`sprint-${taskId}`}
          disabled={busy}
          defaultValue={sprintId ?? ""}
          className="h-8 min-w-0 flex-1 rounded-md border border-black/10 bg-white px-2 text-sm"
          onChange={(e) => save({ sprintId: e.target.value || null })}
        >
          <option value="">Backlog</option>
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name}
              {sprint.isActive ? " (running)" : sprint.isClosed ? " (closed)" : ""}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center justify-between gap-2">
        <label htmlFor={`points-${taskId}`} className="text-sm text-muted-foreground">
          Story points
        </label>
        <Input
          id={`points-${taskId}`}
          type="number"
          min={0}
          disabled={busy}
          defaultValue={storyPoints ?? ""}
          placeholder="—"
          className="h-8 w-24"
          onBlur={(e) => {
            const raw = e.target.value.trim();
            const next = raw === "" ? null : Number(raw);
            if (next === (storyPoints ?? null)) return;
            if (next !== null && (!Number.isInteger(next) || next < 0)) return;
            save({ storyPoints: next });
          }}
        />
      </div>

      {current?.isActive && (
        <p className="text-xs text-muted-foreground">
          This sprint is running — moving the card in or out now is recorded as a scope
          change on its burndown.
        </p>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
