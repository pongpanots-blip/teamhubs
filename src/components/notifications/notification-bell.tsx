"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  taskId: string | null;
  readAt: string | null;
  createdAt: string;
};

/** Polls rather than sockets — the engine only moves tasks on user actions. */
const POLL_MS = 30_000;

const TYPE_BORDER_COLOR: Record<string, string> = {
  task_unblocked: "border-l-emerald-500",
  task_blocked: "border-l-amber-500",
  task_assigned: "border-l-sky-500",
  figma_ready: "border-l-pink-500",
  missing_context: "border-l-red-500",
};
const DEFAULT_BORDER_COLOR = "border-l-slate-300";

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
        className="relative rounded-md p-2 text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-black/10 bg-white p-2 shadow-lg">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-medium text-slate-500">Notifications</span>
            {unread > 0 ? (
              <button
                type="button"
                className="text-xs text-slate-500 hover:underline"
                onClick={() => void markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-2 py-3 text-sm text-slate-500">Nothing yet.</p>
            ) : (
              items.map((n) => {
                const row = (
                  <div
                    className={`rounded-md border-l-4 px-2 py-2 text-sm hover:bg-slate-900/5 ${
                      TYPE_BORDER_COLOR[n.type] ?? DEFAULT_BORDER_COLOR
                    } ${n.readAt ? "text-slate-500" : "text-slate-900"}`}
                  >
                    <p className="font-medium">{n.title}</p>
                    <p className="text-xs text-slate-500">{n.body}</p>
                  </div>
                );
                return n.taskId ? (
                  <Link key={n.id} href={`/app/tasks/${n.taskId}`} onClick={() => setOpen(false)}>
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
