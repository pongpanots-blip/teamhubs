"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardRow, DropZone } from "@/components/sprints/card-row";
import { totalHours, totalPoints, type SprintCard } from "@/components/sprints/types";

/**
 * The uncommitted pile, and the drop target for pulling a card back out of a
 * sprint. It is a column of its own so a card has somewhere to be dragged *to*.
 */
export function BacklogPanel({
  backlog,
  projectSlug,
  busy,
  onMoveCard,
  onSetPoints,
  onSetHours,
}: {
  backlog: SprintCard[];
  projectSlug: string;
  busy: boolean;
  onMoveCard: (taskId: string, sprintId: string | null) => void;
  onSetPoints: (taskId: string, points: number | null) => void;
  onSetHours: (taskId: string, hours: { estimateHours?: number | null; actualHours?: number | null }) => void;
}) {
  return (
    <Card className="lg:sticky lg:top-4">
      <CardHeader>
        <CardTitle className="text-base">
          Backlog
          <span className="ml-2 text-sm font-normal text-slate-500 tabular-nums">
            {backlog.length} cards · {totalPoints(backlog)} pts · {totalHours(backlog).estimate}h
          </span>
        </CardTitle>
        <CardDescription>Drag a card into a sprint to commit it.</CardDescription>
      </CardHeader>
      <CardContent>
        <DropZone
          onDropCard={(taskId) => onMoveCard(taskId, null)}
          disabled={busy}
          className="min-h-24 rounded-lg border border-dashed border-black/10 p-1"
        >
          {backlog.length === 0 ? (
            <p className="px-1 py-6 text-center text-sm text-slate-500">
              Nothing waiting — every open card is in a sprint.
            </p>
          ) : (
            <ul className="divide-y divide-black/5">
              {backlog.map((card) => (
                <CardRow
                  key={card.id}
                  card={card}
                  projectSlug={projectSlug}
                  busy={busy}
                  onSetPoints={onSetPoints}
                  onSetHours={onSetHours}
                />
              ))}
            </ul>
          )}
        </DropZone>
      </CardContent>
    </Card>
  );
}
