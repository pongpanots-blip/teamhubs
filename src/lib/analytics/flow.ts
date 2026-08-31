import type { TaskStatusValue } from "@/lib/task-constants";

export type CardFlow = {
  taskId: string;
  title: string;
  status: TaskStatusValue;
  /** Null while the card is unfinished. */
  cycleTimeMs: number | null;
  doneAt: Date | null;
  /** Null once done, or before work started. */
  wipAgeMs: number | null;
};

export type ThroughputWeek = { weekStart: string; count: number };

/** Monday 00:00 UTC of the week `date` falls in. */
export function weekStartUtc(date: Date): Date {
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  // getUTCDay: Sunday is 0, so Sunday belongs to the week that began 6 days ago.
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d;
}

/**
 * Cards finished per week, oldest first, including weeks where nothing shipped
 * — a run chart with the empty weeks dropped hides exactly the stalls it is
 * meant to show.
 */
export function throughputByWeek(
  cards: CardFlow[],
  range: { from: Date; to: Date },
): ThroughputWeek[] {
  const counts = new Map<string, number>();
  for (const card of cards) {
    if (!card.doneAt) continue;
    const key = weekStartUtc(card.doneAt).toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const weeks: ThroughputWeek[] = [];
  const cursor = weekStartUtc(range.from);
  const last = weekStartUtc(range.to);
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    weeks.push({ weekStart: key, count: counts.get(key) ?? 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return weeks;
}

export type AgingCard = CardFlow & { wipAgeMs: number; breachesSle: boolean };

/**
 * Cards in flight, oldest first, flagged when they have already outlived the
 * team's own p85. This is the realtime warning: it fires while the card can
 * still be helped, instead of at the retro.
 */
export function agingWip(cards: CardFlow[], sleMs: number | null): AgingCard[] {
  return cards
    .filter((c): c is CardFlow & { wipAgeMs: number } => c.wipAgeMs !== null)
    .map((c) => ({ ...c, breachesSle: sleMs !== null && c.wipAgeMs >= sleMs }))
    .sort((a, b) => b.wipAgeMs - a.wipAgeMs);
}
