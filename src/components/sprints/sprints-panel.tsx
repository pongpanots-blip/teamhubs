"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SprintPanel } from "@/components/sprints/sprint-card";
import { BacklogPanel } from "@/components/sprints/backlog-panel";
import { LiveRegion, useLiveAnnouncer } from "@/components/a11y/live-announcer";
import type { SprintCard, SprintSummary } from "@/components/sprints/types";

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "Only a PM can manage sprints",
  END_BEFORE_START: "The sprint has to end after it starts",
  SPRINT_ALREADY_STARTED:
    "This sprint has already started — its commitment is frozen",
  SPRINT_NOT_STARTED: "Start the sprint before completing it",
  SPRINT_ALREADY_COMPLETED: "This sprint is already closed",
  SPRINT_NOT_IN_PROJECT: "That sprint belongs to another project",
  NOT_FOUND: "That sprint no longer exists",
};

/** YYYY-MM-DD (what <input type="date"> speaks) → an instant at UTC midnight. */
export function toIso(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toISOString();
}

export function SprintsPanel({
  initialSprints,
  backlog,
  projectSlug,
  canManage,
  capacityHeadcount,
}: {
  initialSprints: SprintSummary[];
  backlog: SprintCard[];
  projectSlug: string;
  canManage: boolean;
  /** UI + dev headcount on this project — drives the capacity bar on each sprint. */
  capacityHeadcount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { message, announce } = useLiveAnnouncer();

  const allCards = [backlog, ...initialSprints.map((s) => s.tasks)].flat();
  const sprintName = (id: string | null) =>
    id === null ? "the backlog" : (initialSprints.find((s) => s.id === id)?.name ?? "a sprint");

  function moveCard(taskId: string, sprintId: string | null) {
    const title = allCards.find((c) => c.id === taskId)?.title ?? "Card";
    announce(`Moved "${title}" to ${sprintName(sprintId)}`);
    return patchTask(taskId, { sprintId });
  }
  const [form, setForm] = useState({
    name: "",
    goal: "",
    startAt: "",
    endAt: "",
  });

  async function call(fn: () => Promise<Response>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        const code = data.error ?? "Request failed";
        setError(ERROR_MESSAGES[code] ?? code);
        return false;
      }
      // The server component owns this data — re-render it rather than keeping
      // a second copy in sync by hand.
      router.refresh();
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  const patchSprint = (id: string, body: unknown) =>
    call(() =>
      fetch(`/api/sprints/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  const patchTask = (taskId: string, body: unknown) =>
    call(() =>
      fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const ok = await call(() =>
      fetch(`/api/sprints?project=${encodeURIComponent(projectSlug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          goal: form.goal,
          startAt: toIso(form.startAt),
          endAt: toIso(form.endAt),
        }),
      }),
    );
    if (ok) setForm({ name: "", goal: "", startAt: "", endAt: "" });
  }

  return (
    <div className="space-y-6">
      <LiveRegion message={message} />
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {canManage && (
        <Card>
          <CardHeader>
            <CardTitle>Plan a sprint</CardTitle>
            <CardDescription>
              Write the goal first, then pick the cards that get you there — not
              the other way round.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="sprint-name">Name</Label>
                <Input
                  id="sprint-name"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Sprint 14"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sprint-goal">Goal</Label>
                <Input
                  id="sprint-goal"
                  value={form.goal}
                  onChange={(e) => setForm({ ...form, goal: e.target.value })}
                  placeholder="Buyers can reorder from history"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sprint-start">Starts</Label>
                <Input
                  id="sprint-start"
                  type="date"
                  required
                  value={form.startAt}
                  onChange={(e) =>
                    setForm({ ...form, startAt: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sprint-end">Ends</Label>
                <Input
                  id="sprint-end"
                  type="date"
                  required
                  value={form.endAt}
                  onChange={(e) => setForm({ ...form, endAt: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={busy}>
                  Create sprint
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-6">
          {initialSprints.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sprints yet.</p>
          ) : (
            initialSprints.map((sprint) => (
              <SprintPanel
                key={sprint.id}
                sprint={sprint}
                backlog={backlog}
                projectSlug={projectSlug}
                canManage={canManage}
                capacityHeadcount={capacityHeadcount}
                busy={busy}
                onStart={() => patchSprint(sprint.id, { action: "start" })}
                onComplete={() =>
                  patchSprint(sprint.id, { action: "complete" })
                }
                onDelete={() =>
                  call(() =>
                    fetch(`/api/sprints/${sprint.id}`, { method: "DELETE" }),
                  )
                }
                onEdit={(fields) =>
                  patchSprint(sprint.id, {
                    name: fields.name,
                    goal: fields.goal,
                    startAt: toIso(fields.startAt),
                    endAt: toIso(fields.endAt),
                  })
                }
                onMoveCard={(taskId, sprintId) =>
                  patchTask(taskId, { sprintId })
                }
                onSetPoints={(taskId, storyPoints) =>
                  patchTask(taskId, { storyPoints })
                }
                onSetHours={(taskId, hours) => patchTask(taskId, hours)}
              />
            ))
          )}
        </div>
        <BacklogPanel
          backlog={backlog}
          projectSlug={projectSlug}
          busy={busy}
          onMoveCard={moveCard}
          onSetPoints={(taskId, storyPoints) =>
            patchTask(taskId, { storyPoints })
          }
          onSetHours={(taskId, hours) => patchTask(taskId, hours)}
        />
      </div>
    </div>
  );
}
