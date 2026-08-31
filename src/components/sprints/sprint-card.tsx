"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TaskStatusBadge } from "@/components/tasks/status-badge";
import { projectTask } from "@/lib/routes";
import {
  sprintState,
  totalPoints,
  type SprintCard as Card_,
  type SprintSummary,
} from "@/components/sprints/types";

const STATE_LABEL = {
  planning: "Planning",
  active: "Active",
  completed: "Completed",
} as const;

function formatRange(startAt: string, endAt: string): string {
  const fmt = (iso: string) => iso.slice(0, 10);
  return `${fmt(startAt)} → ${fmt(endAt)}`;
}

export function SprintPanel({
  sprint,
  backlog,
  projectSlug,
  canManage,
  busy,
  onStart,
  onComplete,
  onDelete,
  onMoveCard,
  onSetPoints,
}: {
  sprint: SprintSummary;
  backlog: Card_[];
  projectSlug: string;
  canManage: boolean;
  busy: boolean;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onMoveCard: (taskId: string, sprintId: string | null) => void;
  onSetPoints: (taskId: string, points: number | null) => void;
}) {
  // canManage gates the sprint's own lifecycle (PM only, as the API enforces).
  // Committing and sizing cards is a task edit, which any project member may
  // make — gating it here would hide an action the API happily accepts.
  const state = sprintState(sprint);
  const current = totalPoints(sprint.tasks);
  // Only meaningful once the commitment is frozen — before kick-off, "scope
  // change" is just planning.
  const drift =
    sprint.committedPoints === null ? null : current - sprint.committedPoints;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">{sprint.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={state === "active" ? "default" : "secondary"}>
              {STATE_LABEL[state]}
            </Badge>
            {canManage && state === "planning" && (
              <>
                <Button size="sm" disabled={busy} onClick={onStart}>
                  Start sprint
                </Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={onDelete}>
                  Delete
                </Button>
              </>
            )}
            {canManage && state === "active" && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={onComplete}>
                Complete
              </Button>
            )}
          </div>
        </div>
        <CardDescription>
          {formatRange(sprint.startAt, sprint.endAt)}
          {sprint.goal ? ` · ${sprint.goal}` : " · No goal set yet"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <span className="text-slate-600">
            Committed:{" "}
            <strong className="tabular-nums text-slate-900">
              {sprint.committedPoints ?? "—"}
            </strong>
          </span>
          <span className="text-slate-600">
            In scope now:{" "}
            <strong className="tabular-nums text-slate-900">{current}</strong>
          </span>
          {drift !== null && drift !== 0 && (
            <span className={drift > 0 ? "text-red-600" : "text-slate-600"}>
              {drift > 0 ? `+${drift} added after kick-off` : `${drift} traded out`}
            </span>
          )}
        </div>

        {sprint.tasks.length === 0 ? (
          <p className="text-sm text-slate-500">No cards committed yet.</p>
        ) : (
          <ul className="divide-y divide-black/5">
            {sprint.tasks.map((card) => (
              <li key={card.id} className="flex items-center gap-3 py-2">
                <Link
                  href={projectTask(projectSlug, card.id)}
                  className="flex-1 truncate text-sm hover:underline"
                >
                  {card.title}
                </Link>
                <TaskStatusBadge status={card.status} />
                <Input
                  type="number"
                  min={0}
                  aria-label={`Story points for ${card.title}`}
                  defaultValue={card.storyPoints ?? ""}
                  placeholder="pts"
                  disabled={busy}
                  className="h-8 w-20"
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const next = raw === "" ? null : Number(raw);
                    if (next === (card.storyPoints ?? null)) return;
                    if (next !== null && (!Number.isInteger(next) || next < 0)) return;
                    onSetPoints(card.id, next);
                  }}
                />
                {state !== "completed" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => onMoveCard(card.id, null)}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {state !== "completed" && backlog.length > 0 && (
          <div className="flex items-center gap-2 border-t border-black/5 pt-3">
            <label className="text-sm text-slate-600" htmlFor={`add-${sprint.id}`}>
              Add from backlog
            </label>
            <select
              id={`add-${sprint.id}`}
              disabled={busy}
              defaultValue=""
              className="h-9 flex-1 rounded-md border border-black/10 bg-white px-2 text-sm"
              onChange={(e) => {
                if (!e.target.value) return;
                onMoveCard(e.target.value, sprint.id);
                e.target.value = "";
              }}
            >
              <option value="">Pick a card…</option>
              {backlog.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.title}
                  {card.storyPoints === null ? "" : ` (${card.storyPoints})`}
                </option>
              ))}
            </select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
