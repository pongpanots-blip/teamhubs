"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { TaskStatusBadge } from "@/components/tasks/status-badge";
import { projectTask } from "@/lib/routes";
import type { SprintCard } from "@/components/sprints/types";

/** What a drag carries: the id of the card being moved. */
export const CARD_DRAG_TYPE = "application/x-task-id";

/**
 * One card, draggable between the backlog and a sprint. Dragging is the fast
 * path; every row still carries a button/select so the card can be moved
 * without a pointer.
 */
export function CardRow({
  card,
  projectSlug,
  busy,
  onSetPoints,
  action,
}: {
  card: SprintCard;
  projectSlug: string;
  busy: boolean;
  onSetPoints: (taskId: string, points: number | null) => void;
  /** Keyboard-reachable equivalent of dropping this card somewhere else. */
  action?: React.ReactNode;
}) {
  return (
    <li
      draggable={!busy}
      onDragStart={(e) => {
        e.dataTransfer.setData(CARD_DRAG_TYPE, card.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="flex cursor-grab items-center gap-2 rounded-md px-1 py-2 active:cursor-grabbing hover:bg-black/[0.02]"
    >
      <span aria-hidden className="text-xs text-slate-400 select-none">
        ⠿
      </span>
      <div className="min-w-0 flex-1">
        <Link
          href={projectTask(projectSlug, card.id)}
          className="block truncate text-sm hover:underline"
        >
          {card.title}
        </Link>
        <span className="text-xs text-slate-500">
          {card.assigneeName ?? "Unassigned"}
        </span>
      </div>
      <TaskStatusBadge status={card.status} />
      <Input
        type="number"
        min={0}
        aria-label={`Story points for ${card.title}`}
        defaultValue={card.storyPoints ?? ""}
        placeholder="pts"
        disabled={busy}
        className="h-8 w-16"
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const next = raw === "" ? null : Number(raw);
          if (next === (card.storyPoints ?? null)) return;
          if (next !== null && (!Number.isInteger(next) || next < 0)) return;
          onSetPoints(card.id, next);
        }}
      />
      {action}
    </li>
  );
}

/** Wraps a list so a card dropped anywhere on it lands in this bucket. */
export function DropZone({
  onDropCard,
  disabled,
  className = "",
  children,
}: {
  onDropCard: (taskId: string) => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      onDragOver={(e) => {
        if (disabled) return;
        // Without this the browser refuses the drop outright.
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        if (disabled) return;
        const id = e.dataTransfer.getData(CARD_DRAG_TYPE);
        if (id) {
          e.preventDefault();
          onDropCard(id);
        }
      }}
      className={className}
    >
      {children}
    </div>
  );
}
