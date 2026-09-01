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
  onSetHours,
  action,
}: {
  card: SprintCard;
  projectSlug: string;
  busy: boolean;
  onSetPoints: (taskId: string, points: number | null) => void;
  /** Only the estimate is settable — actual hours are derived, never typed. */
  onSetHours: (taskId: string, hours: { estimateHours: number | null }) => void;
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
      /* Wraps because the backlog column is a fixed 320px: the sizing boxes drop
         to their own line there, and stay inline in the wider sprint panel. */
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-md px-1 py-2 hover:bg-foreground/[0.02] cursor-grab active:cursor-grabbing"
    >
      <span aria-hidden className="shrink-0 text-xs text-muted-foreground/70 select-none">
        ⠿
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <Link
          href={projectTask(projectSlug, card.id)}
          className="block truncate text-sm hover:underline"
        >
          {card.title}
        </Link>
        {/* truncate too — an untruncated name overflowed the collapsed column
            and painted on top of the status badge. */}
        <span className="block truncate text-xs text-muted-foreground">
          {card.assigneeName ?? "Unassigned"}
        </span>
      </div>
      <TaskStatusBadge status={card.status} />
      <div className="ml-auto flex shrink-0 items-center gap-2">
        <NumberCell
          label={`Story points for ${card.title}`}
          value={card.storyPoints}
          placeholder="points"
          hint="Story points"
          busy={busy}
          integer
          onSave={(next) => onSetPoints(card.id, next)}
        />
        <NumberCell
          label={`Estimated hours for ${card.title}`}
          value={card.estimateHours}
          placeholder="est hrs"
          hint="Estimated hours"
          busy={busy}
          onSave={(next) => onSetHours(card.id, { estimateHours: next })}
        />
        <ActualCell hours={card.actualHours} source={card.actualHoursSource} />
        {action}
      </div>
    </li>
  );
}

/**
 * Actual hours, shown rather than asked for. The card knows how it was worked
 * out, so say so on hover — a derived number nobody can trace is a number
 * nobody believes.
 */
function ActualCell({ hours, source }: { hours: number | null; source: string | null }) {
  const explanation =
    source === "commits"
      ? "Actual hours — from commit sessions on the linked PR"
      : source === "status"
        ? "Actual hours — from time in Working, capped at 8h/day"
        : hours === null
          ? "Actual hours — filled in when the card is done"
          : "Actual hours — entered by hand before this became automatic";

  return (
    <span
      title={explanation}
      aria-label={explanation}
      className="flex h-8 w-20 shrink-0 items-center justify-center rounded-lg border border-dashed border-input text-sm tabular-nums text-muted-foreground"
    >
      {hours === null ? "—" : `${hours}h`}
    </span>
  );
}

/** One sizing box. Saves on blur, and only when the value actually changed. */
function NumberCell({
  label,
  hint,
  value,
  placeholder,
  busy,
  integer = false,
  onSave,
}: {
  /** Full sentence for screen readers, card title included. */
  label: string;
  /** Short name shown on hover, so the abbreviated placeholder is decodable. */
  hint: string;
  value: number | null;
  placeholder: string;
  busy: boolean;
  integer?: boolean;
  onSave: (next: number | null) => void;
}) {
  return (
    <Input
      type="number"
      min={0}
      step={integer ? 1 : 0.5}
      aria-label={label}
      title={hint}
      defaultValue={value ?? ""}
      placeholder={placeholder}
      disabled={busy}
      className="h-8 w-20 shrink-0"
      onBlur={(e) => {
        const raw = e.target.value.trim();
        const next = raw === "" ? null : Number(raw);
        if (next === (value ?? null)) return;
        if (next !== null && (Number.isNaN(next) || next < 0)) return;
        if (next !== null && integer && !Number.isInteger(next)) return;
        onSave(next);
      }}
    />
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
