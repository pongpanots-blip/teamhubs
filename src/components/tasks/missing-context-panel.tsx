"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export type MissingContextItem = {
  key: string;
  label: string;
  /** Suggested question to send to the PM for this gap, if the engine produced one. */
  question: string;
};

export function MissingContextPanel({
  taskId,
  items,
}: {
  taskId: string;
  items: MissingContextItem[];
}) {
  const router = useRouter();
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (items.length === 0) return null;

  return (
    <Card className="border-warning/40 bg-warning/8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning-strong">
          <span aria-hidden>🔴</span> NOT READY — Missing Context
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.map((item) => (
          <MissingContextRow
            key={item.key}
            taskId={taskId}
            item={item}
            isAnswered={answered.has(item.key)}
            isOpen={openKey === item.key}
            onOpen={() => setOpenKey(item.key)}
            onClose={() => setOpenKey(null)}
            onAnswered={() => {
              setAnswered((prev) => new Set(prev).add(item.key));
              setOpenKey(null);
              router.refresh();
            }}
          />
        ))}
        <p className="pt-1 text-xs text-warning-strong">
          Answering records a decision. Run context again to refresh readiness.
        </p>
      </CardContent>
    </Card>
  );
}

function MissingContextRow({
  taskId,
  item,
  isAnswered,
  isOpen,
  onOpen,
  onClose,
  onAnswered,
}: {
  taskId: string;
  item: MissingContextItem;
  isAnswered: boolean;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onAnswered: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision: item.question, rationale: answer }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setAnswer("");
    onAnswered();
  }

  return (
    <div className="rounded-md border border-warning/25 bg-card/70 p-2 text-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-warning-strong">
          <span aria-hidden>⚠</span> {item.label}
        </span>
        {isAnswered ? (
          <span className="text-xs font-medium text-success">✓ Answered</span>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={isOpen ? onClose : onOpen}
          >
            {isOpen ? "Cancel" : "Ask PM"}
          </Button>
        )}
      </div>
      {isOpen ? (
        <form onSubmit={onSubmit} className="mt-2 space-y-2 border-t border-warning/25 pt-2">
          <p className="text-xs text-muted-foreground">{item.question}</p>
          <Textarea
            aria-label={item.question}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="PM's answer…"
            required
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
          <Button type="submit" size="sm" disabled={loading}>
            {loading ? "Saving…" : "Save answer"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
