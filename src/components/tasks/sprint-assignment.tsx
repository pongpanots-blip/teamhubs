"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { SprintPicker, type SprintOption } from "@/components/tasks/sprint-select";

export type { SprintOption };

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "You do not have permission to change this card",
  NOT_FOUND: "This card no longer exists",
};

/** What the panel can change. actualHours is shown but derived, so it is not here. */
type Sizing = { storyPoints: number | null; estimateHours: number | null };

/**
 * Sprint membership and sizing, editable from the card itself — the fields
 * every flow number downstream depends on, so they belong where the card is
 * being worked on and not only on the planning screen.
 */
export function SprintAssignment({
  taskId,
  sprintId,
  storyPoints,
  estimateHours,
  actualHours,
  actualHoursSource,
  sprints,
}: {
  taskId: string;
  sprintId: string | null;
  sprints: SprintOption[];
  actualHours: number | null;
  actualHoursSource: string | null;
} & Sizing) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(body: Partial<Sizing>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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

  const current = sprints.find((s) => s.id === sprintId);

  return (
    <div className="space-y-2 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Sprint</span>
        <SprintPicker taskId={taskId} sprintId={sprintId} sprints={sprints} />
      </div>

      <NumberField
        id={`points-${taskId}`}
        label="Story points"
        value={storyPoints}
        busy={busy}
        integer
        onSave={(next) => save({ storyPoints: next })}
      />
      <NumberField
        id={`estimate-${taskId}`}
        label="Estimate (h)"
        value={estimateHours}
        busy={busy}
        onSave={(next) => save({ estimateHours: next })}
      />
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Actual (h)</span>
        <span
          title={actualHoursExplanation(actualHours, actualHoursSource)}
          className="flex h-8 w-24 items-center justify-center rounded-lg border border-dashed border-input text-sm tabular-nums text-muted-foreground"
        >
          {actualHours === null ? "—" : `${actualHours}h`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        {actualHoursExplanation(actualHours, actualHoursSource)}
      </p>

      {current?.isActive && (
        <p className="text-xs text-muted-foreground">
          This sprint is running — moving the card in or out now is recorded as a scope
          change on its burndown.
        </p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** Says where a derived number came from, so it can be argued with. */
function actualHoursExplanation(hours: number | null, source: string | null): string {
  if (source === "commits") return "Measured from commit sessions on the linked PR.";
  if (source === "status") return "Measured from time in Working, capped at 8h a day.";
  if (hours === null) return "Filled in automatically once the card is done.";
  return "Entered by hand before this became automatic.";
}

function NumberField({
  id,
  label,
  value,
  busy,
  integer = false,
  onSave,
}: {
  id: string;
  label: string;
  value: number | null;
  busy: boolean;
  integer?: boolean;
  onSave: (next: number | null) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <label htmlFor={id} className="text-sm text-muted-foreground">
        {label}
      </label>
      <Input
        id={id}
        type="number"
        min={0}
        step={integer ? 1 : 0.5}
        disabled={busy}
        defaultValue={value ?? ""}
        placeholder="—"
        className="h-8 w-24"
        onBlur={(e) => {
          const raw = e.target.value.trim();
          const next = raw === "" ? null : Number(raw);
          if (next === (value ?? null)) return;
          if (next !== null && (Number.isNaN(next) || next < 0)) return;
          if (next !== null && integer && !Number.isInteger(next)) return;
          onSave(next);
        }}
      />
    </div>
  );
}
