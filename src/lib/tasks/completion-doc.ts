import { prisma } from "@/lib/db";

/**
 * When one component of a grilled requirement finishes, its completion doc
 * (what got built, how to integrate) needs to reach every sibling sub-task —
 * not just sit on the task that produced it. Reuses TaskHandoff (role is
 * `completion:{sourceComponent}` so multiple sources can land on the same
 * sibling without colliding on the [taskId, role] unique constraint).
 */
export async function forwardCompletionDoc(input: {
  sourceTaskId: string;
  sourceComponent: string;
  title: string;
  content: string;
}) {
  const parentLink = await prisma.taskDependency.findFirst({
    where: { dependencyId: input.sourceTaskId },
    select: { dependentId: true },
  });

  const targetIds = [input.sourceTaskId];
  if (parentLink) {
    const siblingLinks = await prisma.taskDependency.findMany({
      where: { dependentId: parentLink.dependentId, dependencyId: { not: input.sourceTaskId } },
      select: { dependencyId: true },
    });
    targetIds.push(...siblingLinks.map((s) => s.dependencyId));
  }

  const role = `completion:${input.sourceComponent}`;
  await Promise.all(
    targetIds.map((taskId) =>
      prisma.taskHandoff.upsert({
        where: { taskId_role: { taskId, role } },
        create: { taskId, role, title: input.title, content: input.content },
        update: { title: input.title, content: input.content },
      }),
    ),
  );

  return { attachedTo: targetIds };
}
