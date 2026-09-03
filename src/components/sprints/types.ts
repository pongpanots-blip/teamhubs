import type { TaskStatusValue } from "@/lib/task-constants";

export type SprintCard = {
  id: string;
  title: string;
  status: TaskStatusValue;
  storyPoints: number | null;
  estimateHours: number | null;
  actualHours: number | null;
  /** "commits" | "status" | null (legacy hand-entered). Drives the row's tooltip. */
  actualHoursSource: string | null;
  assigneeName: string | null;
  /** Its sub-tasks, shown nested under the card — not full SprintCards, just enough to display. */
  subTasks: { id: string; title: string; status: TaskStatusValue }[];
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

export type SprintProgress = {
  donePoints: number;
  totalPoints: number;
  doneCards: number;
  totalCards: number;
  /** 0-100, by points when the sprint is sized and by card count when it isn't. */
  percent: number;
};

/**
 * How much of the sprint is finished. Points are the honest unit, but a sprint
 * nobody has sized would read 0% forever — so an unsized sprint falls back to
 * counting cards rather than showing a number that never moves.
 */
export function sprintProgress(cards: SprintCard[]): SprintProgress {
  const done = cards.filter((c) => c.status === "done");
  const totalPts = totalPoints(cards);
  const donePts = totalPoints(done);
  const percent =
    totalPts > 0
      ? Math.round((donePts / totalPts) * 100)
      : cards.length > 0
        ? Math.round((done.length / cards.length) * 100)
        : 0;
  return {
    donePoints: donePts,
    totalPoints: totalPts,
    doneCards: done.length,
    totalCards: cards.length,
    percent,
  };
}

/**
 * Whole days from `now` until the sprint ends. Negative once it has run over,
 * so the caller can say "2 days over" without a second calculation.
 */
export function daysLeft(endAt: string, now: Date = new Date()): number {
  const end = new Date(endAt).getTime();
  return Math.ceil((end - now.getTime()) / 86_400_000);
}

export type HoursTotals = { estimate: number; actual: number };

/** Man hours across a set of cards — what was planned, what it has cost. */
export function totalHours(cards: SprintCard[]): HoursTotals {
  return cards.reduce(
    (sum, card) => ({
      estimate: sum.estimate + (card.estimateHours ?? 0),
      actual: sum.actual + (card.actualHours ?? 0),
    }),
    { estimate: 0, actual: 0 },
  );
}

export type PersonLoad = {
  /** null groups every unassigned card together. */
  name: string | null;
  cards: SprintCard[];
  points: number;
  donePoints: number;
  hours: HoursTotals;
};

/**
 * Who is carrying what in this sprint. Unassigned cards are a group of their
 * own rather than being dropped — an unowned card is the thing a PM most needs
 * to see on this screen.
 */
export function loadByPerson(cards: SprintCard[]): PersonLoad[] {
  const groups = new Map<string | null, SprintCard[]>();
  for (const card of cards) {
    const key = card.assigneeName;
    const bucket = groups.get(key);
    if (bucket) bucket.push(card);
    else groups.set(key, [card]);
  }
  return [...groups.entries()]
    .map(([name, group]) => ({
      name,
      cards: group,
      points: totalPoints(group),
      donePoints: totalPoints(group.filter((c) => c.status === "done")),
      hours: totalHours(group),
    }))
    .sort((a, b) => {
      // Unassigned last — it is a gap to fill, not a person's workload.
      if (a.name === null) return 1;
      if (b.name === null) return -1;
      return a.name.localeCompare(b.name);
    });
}
