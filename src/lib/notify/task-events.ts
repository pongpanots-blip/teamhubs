import { postToChat } from "@/lib/notify/chat";
import { TASK_STATUS_LABEL, type TaskStatusValue } from "@/lib/task-constants";

/**
 * Task activity announced to the team chat. In-app notifications only reach the
 * one person they belong to; this is the shared view of "there's new work" and
 * "where the work has got to".
 *
 * Every send is best-effort — chat being down must never fail the request that
 * moved the task.
 */
export type TaskEvent =
  | { kind: "created"; title: string; subTaskCount: number; priority: string; deadline: Date | null }
  | { kind: "status"; title: string; from: TaskStatusValue; to: TaskStatusValue }
  | { kind: "assigned"; title: string; assigneeName: string }
  | { kind: "blocked"; title: string; waitingFor: string }
  | { kind: "unblocked"; title: string; status: TaskStatusValue };

export type TaskEventContext = {
  projectName: string;
  /** Absolute link to the task, so the message is actionable from the chat client. */
  url?: string | null;
  /** Who caused it, when a person did. */
  actorName?: string | null;
};

const STATUS_ICON: Record<string, string> = {
  not_ready: "📋",
  ready: "🟢",
  assigned: "📌",
  working: "🔨",
  review: "👀",
  done: "✅",
  blocked: "🚧",
};

function headline(e: TaskEvent): string {
  switch (e.kind) {
    case "created": {
      const parts = [`🆕 งานใหม่: **${e.title}**`, `[${e.priority.toUpperCase()}]`];
      if (e.deadline) parts.push(`ครบกำหนด ${e.deadline.toISOString().slice(0, 10)}`);
      if (e.subTaskCount > 0) parts.push(`· แตกเป็น ${e.subTaskCount} sub-tasks`);
      return parts.join(" ");
    }
    case "status":
      return `${STATUS_ICON[e.to] ?? "•"} **${e.title}** → ${TASK_STATUS_LABEL[e.to]} (เดิม ${TASK_STATUS_LABEL[e.from]})`;
    case "assigned":
      return `📌 มอบหมาย **${e.title}** ให้ ${e.assigneeName}`;
    case "blocked":
      return `🚧 ติดบล็อก **${e.title}** — ${e.waitingFor}`;
    case "unblocked":
      return `✅ ปลดบล็อกแล้ว **${e.title}** → ${TASK_STATUS_LABEL[e.status]}`;
  }
}

export function formatTaskEvent(e: TaskEvent, cx: TaskEventContext): string {
  const meta = [`_${cx.projectName}_`];
  if (cx.actorName) meta.push(`โดย ${cx.actorName}`);
  const lines = [headline(e), meta.join(" · ")];
  if (cx.url) lines.push(cx.url);
  return lines.join("\n");
}

/** Fire-and-forget: awaited so serverless doesn't kill it, but never rejects. */
export async function notifyTaskEvent(e: TaskEvent, cx: TaskEventContext): Promise<void> {
  const delivery = await postToChat(formatTaskEvent(e, cx));
  if (delivery.attempted && !delivery.ok) {
    console.warn(`[chat] task event not delivered: ${delivery.error}`);
  }
}
