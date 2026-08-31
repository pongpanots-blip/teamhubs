"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/**
 * Creates a sub-task of `parentId` in the same project. The sub-task is a full
 * task, so it lands on its own /app/<slug>/tasks/<id> page.
 */
export function AddSubTaskForm({
  parentId,
  projectSlug,
}: {
  parentId: string;
  projectSlug: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/tasks?project=${encodeURIComponent(projectSlug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description, parentId }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    setTitle("");
    setDescription("");
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        + Add sub-task
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="w-full space-y-2 rounded-[10px] bg-card p-3 ring-1 ring-foreground/[0.06]">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Sub-task title"
        required
        autoFocus
      />
      <Textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="What is this sub-task about? (optional)"
        rows={2}
      />
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading || !title.trim()}>
          {loading ? "Creating…" : "Create sub-task"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
