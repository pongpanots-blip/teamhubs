"use client";

import { useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RegenerateHandoffButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/handoff`, { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed");
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-1 text-right">
      <Button variant="outline" size="sm" onClick={run} disabled={loading}>
        {loading ? "Generating…" : "Regenerate"}
      </Button>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}

export function DownloadHandoffButton({
  fileName,
  content,
}: {
  fileName: string;
  content: string;
}) {
  function download() {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" size="sm" onClick={download}>
      Download .md
    </Button>
  );
}

/**
 * Manual alternative to committing docs/handoff/{taskId}.md to a PR — same
 * forwarding to sibling sub-tasks, but doesn't touch status.
 */
export function UploadCompletionDocForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const content = await file.text();
      const res = await fetch(`/api/tasks/${taskId}/completion-doc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-1">
      <label className="inline-flex">
        <Button variant="outline" size="sm" disabled={loading} nativeButton={false} render={<span />}>
          {loading ? "Uploading…" : "Upload completion .md"}
        </Button>
        <input
          type="file"
          accept=".md,text/markdown"
          className="hidden"
          onChange={onFileChange}
          disabled={loading}
        />
      </label>
      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
