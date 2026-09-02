"use client";

import Link from "next/link";
import { taskStatusStyle } from "@/lib/task-status-style";
import { TASK_STATUSES, TASK_STATUS_COLUMN_LABEL } from "@/lib/task-constants";
import { projectTask } from "@/lib/routes";
import type { SprintCard } from "@/components/sprints/types";

/**
 * A sprint's cards grouped by status, kanban-style — the default view on the
 * sprint panel. Cards stay compact (no inline point/hour editors like
 * CardRow): this view is for reading where work stands, not editing sizing.
 * Moving a card off the sprint is the only action kept here.
 */
export function SprintStatusBoard({
  cards,
  projectSlug,
  busy,
  open,
  onRemove,
}: {
  cards: SprintCard[];
  projectSlug: string;
  busy: boolean;
  /** Whether the sprint still accepts changes — a closed sprint's cards are read-only. */
  open: boolean;
  onRemove: (taskId: string) => void;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1">
      {TASK_STATUSES.map((status) => {
        const columnCards = cards.filter((c) => c.status === status);
        const { color } = taskStatusStyle(status);
        return (
          <div key={status} className="w-[220px] flex-none">
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-meta font-semibold tracking-wide text-muted-foreground uppercase">
                {TASK_STATUS_COLUMN_LABEL[status]}
              </span>
              <span className="ml-auto text-meta text-muted-foreground">{columnCards.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {columnCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-[10px] border-l-[3px] bg-card px-3 py-2.5 ring-1 ring-foreground/[0.07]"
                  style={{ borderLeftColor: color }}
                >
                  <Link
                    href={projectTask(projectSlug, card.id)}
                    className="block text-body leading-snug font-medium hover:underline"
                  >
                    {card.title}
                  </Link>
                  <div className="mt-1.5 flex items-center gap-1.5 text-meta text-muted-foreground">
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-micro font-semibold text-muted-foreground">
                      {card.assigneeName?.[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="truncate">{card.assigneeName ?? "Unassigned"}</span>
                    {card.storyPoints !== null ? (
                      <span className="ml-auto shrink-0 tabular-nums">{card.storyPoints} pts</span>
                    ) : null}
                  </div>
                  {open ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemove(card.id)}
                      className="mt-1.5 text-micro text-muted-foreground hover:text-destructive"
                    >
                      Remove from sprint
                    </button>
                  ) : null}
                </div>
              ))}
              {columnCards.length === 0 ? (
                <p className="px-1 text-meta text-muted-foreground/70">—</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
