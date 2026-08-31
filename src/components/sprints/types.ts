import type { TaskStatusValue } from "@/lib/task-constants";

export type SprintCard = {
  id: string;
  title: string;
  status: TaskStatusValue;
  storyPoints: number | null;
};

export type SprintSummary = {
  id: string;
  name: string;
  goal: string;
  startAt: string;
  endAt: string;
  startedAt: string | null;
  completedAt: string | null;
  committedPoints: number | null;
  tasks: SprintCard[];
};

export type SprintState = "planning" | "active" | "completed";

/** A sprint's state is implied by its two timestamps rather than stored twice. */
export function sprintState(sprint: SprintSummary): SprintState {
  if (sprint.completedAt) return "completed";
  return sprint.startedAt ? "active" : "planning";
}

export function totalPoints(cards: SprintCard[]): number {
  return cards.reduce((sum, card) => sum + (card.storyPoints ?? 0), 0);
}
