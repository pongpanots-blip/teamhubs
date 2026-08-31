import type { TaskStatusValue } from "@/lib/task-constants";

/**
 * Per-status color + tint, reading the `--st-*` CSS vars defined in globals.css
 * (mirrors the "IntrovertHubs UI Mockups" design canvas). Centralized so every
 * status badge in the app stays visually consistent.
 */
export function taskStatusStyle(status: TaskStatusValue): { color: string; bg: string } {
  return {
    color: `var(--st-${status})`,
    bg: status === "not_ready" ? "var(--muted)" : `var(--st-${status}-bg)`,
  };
}
