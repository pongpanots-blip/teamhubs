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

/** Board column headings — the mockup spells these out instead of using the enum. */
export const TASK_STATUS_COLUMN_LABEL: Record<TaskStatusValue, string> = {
  not_ready: "Not ready",
  ready: "Ready",
  assigned: "Assigned",
  working: "Working",
  blocked: "Blocked",
  review: "Review",
  done: "Done",
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

export const TEAM_ROLES = ["pm", "ui", "backend", "mobile", "ai"] as const;
export type TeamRoleValue = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_LABEL: Record<TeamRoleValue, string> = {
  pm: "PM",
  ui: "UI",
  backend: "Backend",
  mobile: "Mobile",
  ai: "AI",
};

/** Any engineering role — everyone except the PM. */
export const ENGINEERING_ROLES: TeamRoleValue[] = ["ui", "backend", "mobile", "ai"];

export const TASK_COMPONENTS = ["ui", "backend", "mobile", "ai"] as const;
export type TaskComponentValue = (typeof TASK_COMPONENTS)[number];

export const TASK_COMPONENT_LABEL: Record<TaskComponentValue, string> = {
  ui: "UI",
  backend: "Backend / API",
  mobile: "Mobile",
  ai: "AI",
};

/** A sub-task's component maps 1:1 to the TeamRole that should own it. */
export const COMPONENT_TO_ROLE: Record<TaskComponentValue, TeamRoleValue> = {
  ui: "ui",
  backend: "backend",
  mobile: "mobile",
  ai: "ai",
};
