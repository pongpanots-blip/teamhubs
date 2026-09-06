"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CommentEntry } from "@/lib/comments/timeline";
import type { Mentionable } from "@/lib/comments/mentions";
import { CommentForm } from "@/components/tasks/comment-form";

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "You can only edit your own comment",
  NOT_FOUND: "This comment no longer exists",
};

/** Bolds `@Name` runs that match a project member, so a mention reads as one unit. */
function highlightMentions(body: string, members: Mentionable[]) {
  const byLongestName = [...members].sort((a, b) => b.name.length - a.name.length);
  const parts: React.ReactNode[] = [];
  let rest = body;
  let key = 0;
  while (rest.length > 0) {
    const at = rest.indexOf("@");
    if (at === -1) {
      parts.push(rest);
      break;
    }
    parts.push(rest.slice(0, at));
    const afterAt = rest.slice(at + 1);
    const match = byLongestName.find((m) => afterAt.startsWith(m.name));
    if (match) {
      parts.push(
        <strong key={key++} style={{ color: "var(--violet)" }}>
          @{match.name}
        </strong>,
      );
      rest = afterAt.slice(match.name.length);
    } else {
      parts.push("@");
      rest = afterAt;
    }
  }
  return parts;
}

export function CommentRow({
  taskId,
  entry,
  members,
  currentUserId,
}: {
  taskId: string;
  entry: CommentEntry;
  members: Mentionable[];
  currentUserId?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOwn = currentUserId === undefined || entry.authorId === currentUserId;

  async function remove() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/tasks/${taskId}/comments/${entry.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(ERROR_MESSAGES[data.error ?? ""] ?? "Failed to delete");
      return;
    }
    router.refresh();
  }

  if (editing) {
    return (
      <CommentForm
        taskId={taskId}
        members={members}
        commentId={entry.id}
        initialBody={entry.body}
        onDone={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="rounded-[10px] bg-muted p-3 text-sm">
      <p className="whitespace-pre-wrap">{highlightMentions(entry.body, members)}</p>
      <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {entry.authorName} · {entry.createdAt.toISOString()}
          {entry.editedAt ? " · edited" : ""}
        </span>
        {isOwn ? (
          <span className="flex gap-2">
            <button type="button" className="hover:underline" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="hover:underline" disabled={busy} onClick={() => void remove()}>
              Delete
            </button>
          </span>
        ) : null}
      </div>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
