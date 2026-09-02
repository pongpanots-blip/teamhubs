"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardRow, DropZone } from "@/components/sprints/card-row";
import {
  daysLeft,
  loadByPerson,
  sprintProgress,
  sprintState,
  totalHours,
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

/** "3 days left" / "2 days over" / "ends today" — the number a PM actually reads. */
function formatDaysLeft(endAt: string): string {
  const days = daysLeft(endAt);
  if (days === 0) return "ends today";
  return days > 0 ? `${days} days left` : `${-days} days over`;
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
  onEdit,
  onMoveCard,
  onSetPoints,
  onSetHours,
}: {
  sprint: SprintSummary;
  backlog: Card_[];
  projectSlug: string;
  canManage: boolean;
  busy: boolean;
  onStart: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onEdit: (fields: {
    name: string;
    goal: string;
    startAt: string;
    endAt: string;
  }) => Promise<boolean>;
  onMoveCard: (taskId: string, sprintId: string | null) => void;
  onSetPoints: (taskId: string, points: number | null) => void;
  /** Only the estimate is settable — actual hours are derived, never typed. */
  onSetHours: (taskId: string, hours: { estimateHours: number | null }) => void;
}) {
  // canManage gates the sprint's own lifecycle (PM only, as the API enforces).
  // Committing and sizing cards is a task edit, which any project member may
  // make — gating it here would hide an action the API happily accepts.
  const state = sprintState(sprint);
  const progress = sprintProgress(sprint.tasks);
  const current = totalPoints(sprint.tasks);
  const [byPerson, setByPerson] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: sprint.name,
    goal: sprint.goal,
    startAt: sprint.startAt.slice(0, 10),
    endAt: sprint.endAt.slice(0, 10),
  });

  function startEditing() {
    setEditForm({
      name: sprint.name,
      goal: sprint.goal,
      startAt: sprint.startAt.slice(0, 10),
      endAt: sprint.endAt.slice(0, 10),
    });
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    const ok = await onEdit(editForm);
    if (ok) setEditing(false);
  }
  // Only meaningful once the commitment is frozen — before kick-off, "scope
  // change" is just planning.
  const drift = sprint.committedPoints === null ? null : current - sprint.committedPoints;
  const people = loadByPerson(sprint.tasks);
  const hours = totalHours(sprint.tasks);
  const open = state !== "completed";

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>{sprint.name}</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={state === "active" ? "default" : "secondary"}>
              {STATE_LABEL[state]}
            </Badge>
            {canManage && (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Edit sprint"
                disabled={busy}
                onClick={() => (editing ? setEditing(false) : startEditing())}
              >
                <Pencil className="size-4" />
              </Button>
            )}
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
                Complete sprint
              </Button>
            )}
          </div>
        </div>
        {editing ? (
          <form onSubmit={saveEdit} className="grid gap-3 pt-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`edit-name-${sprint.id}`}>Name</Label>
              <Input
                id={`edit-name-${sprint.id}`}
                required
                value={editForm.name}
                onChange={(e) =>
                  setEditForm({ ...editForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`edit-goal-${sprint.id}`}>Goal</Label>
              <Input
                id={`edit-goal-${sprint.id}`}
                value={editForm.goal}
                onChange={(e) =>
                  setEditForm({ ...editForm, goal: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`edit-start-${sprint.id}`}>Starts</Label>
              <Input
                id={`edit-start-${sprint.id}`}
                type="date"
                required
                value={editForm.startAt}
                onChange={(e) =>
                  setEditForm({ ...editForm, startAt: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`edit-end-${sprint.id}`}>Ends</Label>
              <Input
                id={`edit-end-${sprint.id}`}
                type="date"
                required
                value={editForm.endAt}
                onChange={(e) =>
                  setEditForm({ ...editForm, endAt: e.target.value })
                }
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={busy}>
                Save changes
              </Button>
            </div>
          </form>
        ) : (
          <CardDescription>
            {formatRange(sprint.startAt, sprint.endAt)}
            {state === "active" ? ` · ${formatDaysLeft(sprint.endAt)}` : ""}
            {sprint.goal ? ` · ${sprint.goal}` : " · No goal set yet"}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-sm">
            <span className="font-medium text-foreground">
              {progress.percent}% done
              <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                {progress.doneCards}/{progress.totalCards} cards
                {progress.totalPoints > 0
                  ? ` · ${progress.donePoints}/${progress.totalPoints} pts`
                  : " · not sized yet"}
              </span>
            </span>
            <span className="text-muted-foreground tabular-nums">
              Man hours:{" "}
              <strong className="text-foreground">{hours.actual}</strong>
              <span className="text-muted-foreground"> / {hours.estimate}h planned</span>
            </span>
            <span className="text-muted-foreground">
              Committed:{" "}
              <strong className="tabular-nums text-foreground">
                {sprint.committedPoints ?? "—"}
              </strong>
              {drift !== null && drift !== 0 && (
                <span className={drift > 0 ? " text-destructive" : " text-muted-foreground"}>
                  {drift > 0 ? ` +${drift} added` : ` ${drift} traded out`}
                </span>
              )}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300"
              style={{ width: `${progress.percent}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {open ? "Drop a card here to commit it" : "Closed — the commitment is final"}
          </span>
          {sprint.tasks.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setByPerson((v) => !v)}
              aria-pressed={byPerson}
            >
              {byPerson ? "Show as one list" : "Group by person"}
            </Button>
          )}
        </div>

        <DropZone
          onDropCard={(taskId) => onMoveCard(taskId, sprint.id)}
          disabled={!open || busy}
          className={
            open
              ? "min-h-16 rounded-lg border border-dashed border-border p-1"
              : "rounded-lg p-1"
          }
        >
          {sprint.tasks.length === 0 ? (
            <p className="px-1 py-4 text-center text-sm text-muted-foreground">
              No cards committed yet.
            </p>
          ) : byPerson ? (
            <div className="space-y-3">
              {people.map((person) => (
                <div key={person.name ?? "__unassigned"}>
                  <div className="flex items-baseline justify-between px-1 text-xs">
                    <span className={person.name ? "font-medium" : "font-medium text-warning-strong"}>
                      {person.name ?? "Unassigned"}
                    </span>
                    <span className="text-muted-foreground tabular-nums">
                      {person.cards.length} cards · {person.donePoints}/{person.points} pts ·{" "}
                      {person.hours.actual}/{person.hours.estimate}h
                    </span>
                  </div>
                  <ul className="divide-y divide-black/5">
                    {person.cards.map((card) => (
                      <CardRow
                        key={card.id}
                        card={card}
                        projectSlug={projectSlug}
                        busy={busy}
                        onSetPoints={onSetPoints}
                        onSetHours={onSetHours}
                        action={
                          open ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy}
                              onClick={() => onMoveCard(card.id, null)}
                            >
                              Remove
                            </Button>
                          ) : undefined
                        }
                      />
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-black/5">
              {sprint.tasks.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  projectSlug={projectSlug}
                  busy={busy}
                  onSetPoints={onSetPoints}
                  onSetHours={onSetHours}
                  action={
                    open ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => onMoveCard(card.id, null)}
                      >
                        Remove
                      </Button>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          )}
        </DropZone>

        {open && backlog.length > 0 && (
          <div className="flex items-center gap-2 border-t border-border pt-3">
            <label className="text-sm text-muted-foreground" htmlFor={`add-${sprint.id}`}>
              Add from backlog
            </label>
            <select
              id={`add-${sprint.id}`}
              disabled={busy}
              defaultValue=""
              className="h-9 flex-1 rounded-md border border-border bg-card px-2 text-sm"
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
