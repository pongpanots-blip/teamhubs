"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function RunContextButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/context`, { method: "POST" });
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
      <Button onClick={run} disabled={loading}>
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Running…
          </span>
        ) : (
          "Run context"
        )}
      </Button>
      {loading ? (
        <p className="text-xs text-muted-foreground">
          Asking Gemini + gathering docs — can take a couple of minutes.
        </p>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
