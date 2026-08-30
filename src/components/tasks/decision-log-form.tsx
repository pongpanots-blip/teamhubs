"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function DecisionLogForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [decision, setDecision] = useState("");
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/decisions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision, rationale }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setDecision("");
    setRationale("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="space-y-1">
        <Label>Decision</Label>
        <Input value={decision} onChange={(e) => setDecision(e.target.value)} required />
      </div>
      <div className="space-y-1">
        <Label>Rationale</Label>
        <Textarea value={rationale} onChange={(e) => setRationale(e.target.value)} />
      </div>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <Button type="submit" size="sm" disabled={loading}>
        {loading ? "Saving…" : "Add decision"}
      </Button>
    </form>
  );
}
