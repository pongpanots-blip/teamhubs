import { Prisma, type Task, type TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ClaudeTaskAnalysisSchema, type ClaudeTaskAnalysis } from "@/lib/ai/schemas";
import { runDeterministicEngine, type EngineDependency } from "@/lib/engine";
import { notifyTaskEvent } from "@/lib/notify/task-events";
import type { TaskStatusValue } from "@/lib/task-constants";

/** Guards against a dependency cycle turning the cascade into an infinite walk. */
const MAX_CASCADE_DEPTH = 10;

/**
 * Analysis used when a task has never been through the Claude pipeline.
 * Everything is empty, so the engine falls back to task fields alone — which is
 * exactly right: dependency resolution is deterministic and needs no LLM.
 */
export const EMPTY_ANALYSIS: ClaudeTaskAnalysis = ClaudeTaskAnalysisSchema.parse({
  contextSummary: "",
});

/** Replay the last stored Claude analysis so re-evaluation costs no API call. */
export async function lastAnalysisFor(taskId: string): Promise<ClaudeTaskAnalysis> {
  const run = await prisma.contextRun.findFirst({
    where: { taskId, analysis: { not: Prisma.JsonNull } },
    orderBy: { createdAt: "desc" },
    select: { analysis: true },
  });
  if (!run?.analysis) return EMPTY_ANALYSIS;
  const parsed = ClaudeTaskAnalysisSchema.safeParse(run.analysis);
  return parsed.success ? parsed.data : EMPTY_ANALYSIS;
}

export async function dependenciesOf(taskId: string): Promise<EngineDependency[]> {
  const rows = await prisma.taskDependency.findMany({
    where: { dependentId: taskId },
    include: {
      dependency: { include: { assignee: { select: { id: true, name: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.dependency.id,
    title: r.dependency.title,
    status: r.dependency.status,
    assigneeId: r.dependency.assigneeId,
    assigneeName: r.dependency.assignee?.name ?? null,
  }));
}

export type Reevaluation = {
  task: Task;
  previousStatus: TaskStatus;
  status: TaskStatus;
  changed: boolean;
  waitingFor: string;
};

/**
 * Recompute one task's status from current dependency state — no Claude call.
 * Only the dependency-driven fields are written; readiness stays whatever the
 * last full pipeline run decided, since nothing else about the task changed.
 */
export async function reevaluateTask(taskId: string): Promise<Reevaluation | null> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return null;

  const [dependencies, analysis] = await Promise.all([
    dependenciesOf(taskId),
    lastAnalysisFor(taskId),
  ]);
  const siblings = await prisma.task.findMany({
    where: { projectId: task.projectId, id: { not: task.id } },
    select: { id: true, title: true, status: true },
  });

  const output = runDeterministicEngine({ task, dependencies, analysis, siblingTitles: siblings });
  const changed = output.status !== task.status;

  const updated = changed
    ? await prisma.task.update({
        where: { id: task.id },
        data: {
          status: output.status,
          engineStatus: output.status,
          readinessNotes: output.readinessNotes,
        },
      })
    : task;

  return {
    task: updated,
    previousStatus: task.status,
    status: output.status,
    changed,
    waitingFor: output.waitingFor,
  };
}

/**
 * A task changed — re-evaluate everything that depends on it, transitively.
 * This is what turns "API done" into "Frontend ready" without anyone opening
 * the frontend task: the gate in computeStatus only runs when something asks it to.
 */
export async function cascadeFromTask(taskId: string): Promise<Reevaluation[]> {
  const results: Reevaluation[] = [];
  const visited = new Set<string>([taskId]);
  let frontier = [taskId];

  for (let depth = 0; depth < MAX_CASCADE_DEPTH && frontier.length > 0; depth++) {
    const edges = await prisma.taskDependency.findMany({
      where: { dependencyId: { in: frontier } },
      select: { dependentId: true },
    });
    const next: string[] = [];

    for (const { dependentId } of edges) {
      if (visited.has(dependentId)) continue;
      visited.add(dependentId);

      const result = await reevaluateTask(dependentId);
      if (!result) continue;
      results.push(result);
      if (result.changed) {
        await notifyStatusChange(result);
        // Only a changed status can move anything downstream.
        next.push(dependentId);
      }
    }
    frontier = next;
  }

  return results;
}

/** Tell the owner when the engine moves their task in or out of BLOCKED. */
async function notifyStatusChange(result: Reevaluation) {
  const { task, previousStatus, status, waitingFor } = result;

  const becameBlocked = status === "blocked" && previousStatus !== "blocked";
  const becameUnblocked = previousStatus === "blocked" && status !== "blocked";
  if (!becameBlocked && !becameUnblocked) return;

  // Chat gets it either way — a blocked task with no owner is exactly the kind
  // of thing the team needs to see.
  const project = await prisma.project.findUnique({
    where: { id: task.projectId },
    select: { name: true },
  });
  await notifyTaskEvent(
    becameBlocked
      ? { kind: "blocked", title: task.title, waitingFor: waitingFor || "รอ dependency ที่ยังไม่เสร็จ" }
      : { kind: "unblocked", title: task.title, status: status as TaskStatusValue },
    { projectName: project?.name ?? "—" },
  );

  if (!task.assigneeId) return;

  await prisma.notification.create({
    data: {
      teamId: task.teamId,
      projectId: task.projectId,
      userId: task.assigneeId,
      taskId: task.id,
      type: becameBlocked ? "task_blocked" : "task_unblocked",
      title: becameBlocked ? `🚧 Blocked: ${task.title}` : `✅ Unblocked: ${task.title}`,
      body: becameBlocked
        ? waitingFor || "A dependency is not finished yet."
        : `Dependencies resolved — task is now ${status.toUpperCase()}.`,
    },
  });
}
