import type { Prisma } from "@prisma/client";

/**
 * Atomically hands out the next ticket number for a project. Must run inside
 * the same transaction as the task's `create`, so a failed task-create never
 * burns a number and two concurrent creates never collide.
 */
export async function allocateTaskNumber(
  tx: Prisma.TransactionClient,
  projectId: string,
): Promise<{ taskNumber: number; keyPrefix: string }> {
  const project = await tx.project.update({
    where: { id: projectId },
    data: { nextTaskNumber: { increment: 1 } },
    select: { nextTaskNumber: true, keyPrefix: true },
  });
  return { taskNumber: project.nextTaskNumber - 1, keyPrefix: project.keyPrefix };
}
