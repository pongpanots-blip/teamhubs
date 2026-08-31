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

export const TEAM_ROLES = ["pm", "ui", "website", "backend", "mobile", "ai"] as const;
export type TeamRoleValue = (typeof TEAM_ROLES)[number];

export const TEAM_ROLE_LABEL: Record<TeamRoleValue, string> = {
  pm: "PM",
  ui: "UI",
  website: "Website",
  backend: "Backend",
  mobile: "Mobile",
  ai: "AI Dev",
};

/** Any engineering role — everyone except the PM. */
export const ENGINEERING_ROLES: TeamRoleValue[] = ["ui", "website", "backend", "mobile", "ai"];

export const TASK_COMPONENTS = ["ui", "website", "backend", "mobile", "ai"] as const;
export type TaskComponentValue = (typeof TASK_COMPONENTS)[number];

export const TASK_COMPONENT_LABEL: Record<TaskComponentValue, string> = {
  ui: "UI",
  website: "Website",
  backend: "Backend / API",
  mobile: "Mobile",
  ai: "AI Dev",
};

/** A sub-task's component maps 1:1 to the TeamRole that should own it. */
export const COMPONENT_TO_ROLE: Record<TaskComponentValue, TeamRoleValue> = {
  ui: "ui",
  website: "website",
  backend: "backend",
  mobile: "mobile",
  ai: "ai",
};

export const STATUS_CATEGORIES = ["backlog", "active", "waiting", "done"] as const;
export type StatusCategoryValue = (typeof STATUS_CATEGORIES)[number];

/**
 * Which flow bucket each status belongs to.
 *
 * `assigned` is backlog, not active — ownership is not work (see isActiveWork).
 * Counting it as active would make cycle time start the moment a PM picks an
 * owner, which is exactly the inflation the metric is meant to expose.
 * `review` and `blocked` are both waiting: the card is idle, waiting on someone.
 */
export const STATUS_CATEGORY: Record<TaskStatusValue, StatusCategoryValue> = {
  not_ready: "backlog",
  ready: "backlog",
  assigned: "backlog",
  working: "active",
  blocked: "waiting",
  review: "waiting",
  done: "done",
};

/**
 * Forward progress order, used to detect rework (a move to a lower rank).
 * `blocked` shares a rank with `working` on purpose: getting blocked mid-work
 * is an interruption, not a step backwards, and should not inflate rework.
 */
const STATUS_RANK: Record<TaskStatusValue, number> = {
  not_ready: 0,
  ready: 1,
  assigned: 2,
  working: 3,
  blocked: 3,
  review: 4,
  done: 5,
};

/** True when a transition moves the card backwards through the workflow. */
export function isRework(from: TaskStatusValue, to: TaskStatusValue): boolean {
  return STATUS_RANK[to] < STATUS_RANK[from];
}
