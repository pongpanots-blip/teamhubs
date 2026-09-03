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
          <div key={status} className="flex max-h-[480px] w-[260px] flex-none flex-col">
            <div className="mb-2.5 flex items-center gap-2 px-1">
              <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {TASK_STATUS_COLUMN_LABEL[status]}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{columnCards.length}</span>
            </div>
            {/* Column scrolls on its own — a busy status shouldn't push the page
                itself taller, the way a Jira board's columns behave. */}
            <div className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-0.5">
              {columnCards.map((card) => (
                <div
                  key={card.id}
                  className="rounded-[10px] border-l-[3px] bg-card px-3.5 py-3 ring-1 ring-foreground/[0.07]"
                  style={{ borderLeftColor: color }}
                >
                  <Link
                    href={projectTask(projectSlug, card.id)}
                    className="block text-sm leading-snug font-medium hover:underline"
                  >
                    {card.title}
                  </Link>
                  <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {card.assigneeName?.[0]?.toUpperCase() ?? "?"}
                    </span>
                    <span className="truncate">{card.assigneeName ?? "Unassigned"}</span>
                    {card.storyPoints !== null ? (
                      <span className="ml-auto shrink-0 tabular-nums">{card.storyPoints} pts</span>
                    ) : null}
                  </div>
                  {card.subTasks.length > 0 ? (
                    <div className="mt-2.5 flex flex-col gap-1.5 border-t border-dashed border-border pt-2">
                      {card.subTasks.map((sub) => (
                        <Link
                          key={sub.id}
                          href={projectTask(projectSlug, sub.id)}
                          className="flex items-center gap-1.5 pl-2.5 text-xs hover:underline"
                        >
                          <span
                            className="size-1.5 shrink-0 rounded-full"
                            style={{ backgroundColor: taskStatusStyle(sub.status).color }}
                          />
                          <span className="min-w-0 flex-1 truncate">{sub.title}</span>
                          <span className="shrink-0 text-muted-foreground">
                            {TASK_STATUS_COLUMN_LABEL[sub.status]}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ) : null}
                  {open ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => onRemove(card.id)}
                      className="mt-2 text-xs text-muted-foreground hover:text-destructive"
                    >
                      Remove from sprint
                    </button>
                  ) : null}
                </div>
              ))}
              {columnCards.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground/70">—</p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
