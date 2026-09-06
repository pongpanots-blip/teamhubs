"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { Mentionable } from "@/lib/comments/mentions";

const ERROR_MESSAGES: Record<string, string> = {
  FORBIDDEN: "You can only edit your own comment",
  NOT_FOUND: "This comment no longer exists",
};

/** Word characters typed after the last unmatched "@" — the live autocomplete query. */
function activeMentionQuery(value: string, cursor: number): string | null {
  const before = value.slice(0, cursor);
  const at = before.lastIndexOf("@");
  if (at === -1) return null;
  const between = before.slice(at + 1);
  if (/[\n@]/.test(between)) return null; // a newline or another @ closes the mention
  return between;
}

/**
 * A comment composer — used both for a new top-level comment and, with
 * `commentId`/`initialBody`/`onDone` set, in place for editing an existing one.
 */
export function CommentForm({
  taskId,
  members,
  commentId,
  initialBody = "",
  onDone,
}: {
  taskId: string;
  members: Mentionable[];
  commentId?: string;
  initialBody?: string;
  onDone?: () => void;
}) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState(initialBody);
  const [cursor, setCursor] = useState(initialBody.length);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingSelectionRef = useRef<number | null>(null);

  // Runs synchronously right after the DOM commits the inserted mention, so the
  // caret lands correctly even when a caller (or automation) types again
  // immediately — a requestAnimationFrame callback would race that.
  useLayoutEffect(() => {
    if (pendingSelectionRef.current === null) return;
    const pos = pendingSelectionRef.current;
    pendingSelectionRef.current = null;
    const el = textareaRef.current;
    el?.focus();
    el?.setSelectionRange(pos, pos);
  }, [value]);

  const query = activeMentionQuery(value, cursor);
  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return members.filter((m) => m.name.toLowerCase().startsWith(q)).slice(0, 5);
  }, [query, members]);

  function insertMention(name: string) {
    const at = value.slice(0, cursor).lastIndexOf("@");
    const next = `${value.slice(0, at)}@${name} ${value.slice(cursor)}`;
    const nextCursor = at + name.length + 2; // "@" + name + trailing space
    setValue(next);
    setCursor(nextCursor);
    pendingSelectionRef.current = nextCursor;
  }

  async function submit() {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    const url = commentId
      ? `/api/tasks/${taskId}/comments/${commentId}`
      : `/api/tasks/${taskId}/comments`;
    const res = await fetch(url, {
      method: commentId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: value }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(ERROR_MESSAGES[data.error ?? ""] ?? "Failed to save");
      return;
    }
    if (!commentId) setValue("");
    onDone?.();
    router.refresh();
  }

  return (
    <div className="relative space-y-2">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setCursor(e.target.selectionStart);
        }}
        onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
        placeholder="Write a comment — @ to mention someone"
        rows={commentId ? 2 : 3}
      />
      {suggestions.length > 0 ? (
        <div className="absolute z-10 w-64 rounded-lg border border-border bg-card p-1 shadow-lg">
          {suggestions.map((m) => (
            <button
              key={m.id}
              type="button"
              className="block w-full rounded-md px-2 py-1 text-left text-sm hover:bg-foreground/5"
              onClick={() => insertMention(m.name)}
            >
              {m.name}
            </button>
          ))}
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="button" size="sm" disabled={busy || !value.trim()} onClick={() => void submit()}>
          {busy ? "Saving…" : commentId ? "Save" : "Comment"}
        </Button>
        {commentId ? (
          <Button type="button" size="sm" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}
