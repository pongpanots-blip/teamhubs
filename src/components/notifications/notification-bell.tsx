"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { projectTask } from "@/lib/routes";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  taskId: string | null;
  projectSlug: string | null;
  projectName: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Polls rather than sockets — the engine only moves tasks on user actions. */
const POLL_MS = 30_000;

const TYPE_BORDER_COLOR: Record<string, string> = {
  task_unblocked: "var(--st-done)",
  task_blocked: "var(--st-working)",
  task_assigned: "var(--st-ready)",
  figma_ready: "oklch(0.6 0.18 350)",
  missing_context: "var(--destructive)",
};
const DEFAULT_BORDER_COLOR = "var(--border)";

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.notifications ?? []);
    } catch {
      // offline / signed out — keep whatever we last showed
    }
  }, []);

  useEffect(() => {
    // Deferred so the first fetch lands after paint rather than during the effect.
    const first = setTimeout(() => void load(), 0);
    const timer = setInterval(() => void load(), POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [load]);

  const unread = items.filter((n) => !n.readAt).length;

  async function markAllRead() {
    setItems((prev) => prev.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        className="relative flex size-8 items-center justify-center rounded-lg text-foreground hover:bg-foreground/5"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="size-[17px]" strokeWidth={1.8} />
        {unread > 0 ? (
          <span
            className="absolute -top-px -right-px flex h-[15px] min-w-[15px] items-center justify-center rounded-full px-[3px] text-micro font-semibold text-background"
            style={{ backgroundColor: "oklch(0.55 0.22 27)" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute top-10 right-0 z-20 w-80 rounded-xl bg-card p-1.5 shadow-[0_0_0_1px_rgb(0_0_0_/_0.08),0_10px_30px_rgb(0_0_0_/_0.1)]">
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-meta font-semibold tracking-wide text-muted-foreground uppercase">
              Notifications
            </span>
            {unread > 0 ? (
              <button
                type="button"
                className="text-meta text-muted-foreground hover:underline"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="flex max-h-[340px] flex-col gap-0.5 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              items.map((n) => {
                const row = (
                  <div
                    className="rounded-lg border-l-[3px] px-2.5 py-2 text-sm hover:bg-foreground/5"
                    style={{ borderColor: TYPE_BORDER_COLOR[n.type] ?? DEFAULT_BORDER_COLOR }}
                  >
                    <p className={`text-body font-medium ${n.readAt ? "text-muted-foreground" : "text-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>
                    {n.projectName ? (
                      <p className="mt-0.5 text-meta" style={{ color: "oklch(0.7 0 0)" }}>
                        {n.projectName}
                      </p>
                    ) : null}
                  </div>
                );
                return n.taskId && n.projectSlug ? (
                  <Link
                    key={n.id}
                    href={projectTask(n.projectSlug, n.taskId)}
                    onClick={() => setOpen(false)}
                  >
                    {row}
                  </Link>
                ) : (
                  <div key={n.id}>{row}</div>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
