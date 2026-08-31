import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { STATUS_CATEGORY, type TaskStatusValue } from "@/lib/task-constants";

/**
 * Accepts either the client or a transaction client, so a caller that already
 * has a transaction open writes the history row inside it.
 */
type Db = Prisma.TransactionClient;

export type StatusChange = {
  taskId: string;
  /** Null only for the opening row written when a task is created. */
  from: TaskStatusValue | null;
  to: TaskStatusValue;
  /** Null when the change came from the engine, a webhook or the pipeline. */
  changedById?: string | null;
};

/**
 * Append one transition to the flow log — the single write path for
 * TaskStatusHistory. Every place that changes Task.status must call this, or
 * the card silently drops out of the flow metrics.
 *
 * A no-op transition (from === to) is not logged: it would add a zero-length
 * segment that skews time-in-status without representing anything real.
 */
export async function recordStatusChange(
  change: StatusChange,
  db: Db = prisma,
): Promise<void> {
  if (change.from === change.to) return;
  await db.taskStatusHistory.create({
    data: {
      taskId: change.taskId,
      fromStatus: change.from,
      toStatus: change.to,
      category: STATUS_CATEGORY[change.to],
      changedById: change.changedById ?? null,
    },
  });
}
