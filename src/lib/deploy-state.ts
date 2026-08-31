import type { TaskStatusValue } from "@/lib/task-constants";

export type DeployStateValue = "not_started" | "awaiting" | "deployed";

/**
 * Deploy progress isn't stored — it's read off the task status, which is the
 * only signal the app has today: work that reached review is waiting to ship,
 * and done means it shipped.
 */
export function deployState(status: TaskStatusValue): DeployStateValue {
  if (status === "done") return "deployed";
  if (status === "working" || status === "review") return "awaiting";
  return "not_started";
}

export const DEPLOY_STATE_LABEL: Record<DeployStateValue, string> = {
  not_started: "⏳ Not started",
  awaiting: "🚚 Awaiting deploy",
  deployed: "🚀 Deployed",
};

export const DEPLOY_STATE_STYLE: Record<DeployStateValue, { color: string; bg: string }> = {
  not_started: { color: "var(--muted-foreground)", bg: "var(--muted)" },
  awaiting: { color: "oklch(0.5 0.13 70)", bg: "oklch(0.62 0.15 70 / 0.14)" },
  deployed: { color: "var(--st-done)", bg: "var(--st-done-bg)" },
};
