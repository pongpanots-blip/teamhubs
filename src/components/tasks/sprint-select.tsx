"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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

const BACKLOG = "__backlog";

/**
 * Move one card between the backlog and a sprint: the current sprint is
 * readable at a glance on the pill, and picking another is one click on a
 * short list. Lives on every surface that lists cards — planning is a decision
 * a PM makes while looking at the board, not one worth a detour through the
 * card's own page.
 */
export function SprintPicker({
  taskId,
  sprintId,
  sprints,
  className = "",
}: {
  taskId: string;
  sprintId: string | null;
  sprints: SprintOption[];
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const current = sprints.find((s) => s.id === sprintId) ?? null;

  async function save(next: string | null) {
    if (next === sprintId) return;
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

  return (
    <div className={`min-w-0 ${className}`}>
      <DropdownMenu>
        <DropdownMenuTrigger
          disabled={busy}
          aria-label="Sprint for this card"
          className={`inline-flex h-7 max-w-full items-center gap-1 rounded-lg border px-2.5 text-xs disabled:opacity-50 ${
            current
              ? "border-transparent bg-foreground/[0.06] font-medium"
              : "border-dashed border-foreground/20 text-muted-foreground"
          }`}
        >
          <span className="truncate">{current?.name ?? "Backlog"}</span>
          {current?.isActive && (
            <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-success" />
          )}
          <span aria-hidden className="shrink-0 text-micro opacity-60">
            ▾
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-44">
          <DropdownMenuRadioGroup
            value={sprintId ?? BACKLOG}
            onValueChange={(value) => save(value === BACKLOG ? null : value)}
          >
            <DropdownMenuRadioItem value={BACKLOG}>Backlog</DropdownMenuRadioItem>
            {sprints.map((sprint) => (
              <DropdownMenuRadioItem key={sprint.id} value={sprint.id}>
                <span className="truncate">{sprint.name}</span>
                {sprint.isActive && (
                  <span className="ml-1 text-micro text-success">running</span>
                )}
                {sprint.isClosed && (
                  <span className="ml-1 text-micro text-muted-foreground">closed</span>
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}
