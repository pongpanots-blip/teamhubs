"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
 * Move one card between the backlog and a sprint. Lives on every surface that
 * lists cards — planning is a decision a PM makes while looking at the board,
 * not one worth a detour through the card's own page.
 */
export function SprintSelect({
  taskId,
  sprintId,
  sprints,
  className = "",
  label,
}: {
  taskId: string;
  sprintId: string | null;
  sprints: SprintOption[];
  className?: string;
  /** Visible label; falls back to an aria-label when the row has its own header. */
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(next: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sprintId: next }),
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

  const select = (
    <select
      id={`sprint-${taskId}`}
      aria-label={label ? undefined : `Sprint for this card`}
      disabled={busy}
      value={sprintId ?? ""}
      className={`h-8 min-w-0 rounded-md border border-black/10 bg-white px-2 text-xs ${className}`}
      onChange={(e) => save(e.target.value || null)}
    >
      <option value="">Backlog</option>
      {sprints.map((sprint) => (
        <option key={sprint.id} value={sprint.id}>
          {sprint.name}
          {sprint.isActive ? " (running)" : sprint.isClosed ? " (closed)" : ""}
        </option>
      ))}
    </select>
  );

  if (!label) {
    return (
      <>
        {select}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </>
    );
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={`sprint-${taskId}`} className="text-sm text-muted-foreground">
        {label}
      </label>
      <div className="flex min-w-0 flex-1 flex-col items-end gap-1">
        {select}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    </div>
  );
}
