export const TASK_STATUSES = [
  "not_ready",
  "ready",
  "assigned",
  "working",
  "blocked",
  "review",
  "done",
] as const;

export type TaskStatusValue = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABEL: Record<TaskStatusValue, string> = {
  not_ready: "NOT_READY",
  ready: "READY",
  assigned: "ASSIGNED",
  working: "WORKING",
  blocked: "BLOCKED",
  review: "REVIEW",
  done: "DONE",
};

export const TASK_PRIORITIES = ["p0", "p1", "p2", "p3"] as const;
export type TaskPriorityValue = (typeof TASK_PRIORITIES)[number];

export const TASK_PRIORITY_LABEL: Record<TaskPriorityValue, string> = {
  p0: "P0 Critical",
  p1: "P1 High",
  p2: "P2 Medium",
  p3: "P3 Low",
};

export const TASK_PRIORITY_SHORT_LABEL: Record<TaskPriorityValue, string> = {
  p0: "Critical",
  p1: "High",
  p2: "Medium",
  p3: "Low",
};

/** Assigned means ownership only — never treat as active work. */
export function isActiveWork(status: TaskStatusValue): boolean {
  return status === "working" || status === "review";
}
