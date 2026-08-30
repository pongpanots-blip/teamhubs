import {
  TASK_PRIORITIES,
  type TaskPriorityValue,
  type TaskStatusValue,
} from "@/lib/task-constants";

export type HomeTask = {
  id: string;
  title: string;
  status: TaskStatusValue;
  priority: TaskPriorityValue;
  deadline: Date | null;
  assigneeId: string | null;
  readinessScore: number;
  requirementPresent: boolean;
  rulesPresent: boolean;
  acPresent: boolean;
  figmaReady: boolean;
};

/**
 * Statuses that represent work still in play. Distinct from
 * task-constants.ts's isActiveWork(), which only covers working/review.
 */
export const OPEN_STATUSES: TaskStatusValue[] = [
  "ready",
  "assigned",
  "working",
  "blocked",
  "review",
];

export function isOpenStatus(status: TaskStatusValue): boolean {
  return OPEN_STATUSES.includes(status);
}

function priorityRank(priority: TaskPriorityValue): number {
  return TASK_PRIORITIES.indexOf(priority);
}

export function pickCurrentTask(
  tasks: HomeTask[],
): { task: HomeTask | null; extraCount: number } {
  const open = tasks.filter((t) => isOpenStatus(t.status));
  if (open.length === 0) return { task: null, extraCount: 0 };

  const sorted = [...open].sort((a, b) => {
    const rankDiff = priorityRank(a.priority) - priorityRank(b.priority);
    if (rankDiff !== 0) return rankDiff;
    if (a.deadline && b.deadline) return a.deadline.getTime() - b.deadline.getTime();
    if (a.deadline) return -1;
    if (b.deadline) return 1;
    return 0;
  });

  return { task: sorted[0], extraCount: sorted.length - 1 };
}

export function isMissingContext(task: HomeTask): boolean {
  return (
    task.readinessScore < 50 ||
    !task.requirementPresent ||
    !task.rulesPresent ||
    !task.acPresent
  );
}

export function isUiReadyForDev(task: HomeTask): boolean {
  return (
    task.figmaReady &&
    (task.status === "not_ready" || task.status === "ready")
  );
}

export type AttentionCounts = {
  missingContext: number;
  blocked: number;
  uiReadyForDev: number;
};

export function computeAttentionCounts(tasks: HomeTask[]): AttentionCounts {
  let missingContext = 0;
  let blocked = 0;
  let uiReadyForDev = 0;
  for (const task of tasks) {
    if (isMissingContext(task)) missingContext++;
    if (task.status === "blocked") blocked++;
    if (isUiReadyForDev(task)) uiReadyForDev++;
  }
  return { missingContext, blocked, uiReadyForDev };
}
