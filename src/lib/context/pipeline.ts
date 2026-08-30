import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { RAG_MAX_DISTANCE, retrieveRelevantChunks } from "@/lib/context/ingest";
import { fetchGitHubContext } from "@/lib/integrations/github";
import { fetchFigmaContext } from "@/lib/integrations/figma";
import { analyzeTaskWithClaude } from "@/lib/ai/claude";
import { generateHandoffDocs, type HandoffDoc } from "@/lib/ai/handoff";
import { runDeterministicEngine, type EngineOutput } from "@/lib/engine";
import { cascadeFromTask } from "@/lib/engine/cascade";
import type { Task } from "@prisma/client";
import type { ClaudeTaskAnalysis } from "@/lib/ai/schemas";

/**
 * Context Engine + RAG + Claude + Validation + Deterministic Engine
 *
 * Flow:
 *   PM Requirement
 *     → Context Engine (query assembly)
 *     → Internal Docs search (RAG top-k only — never full corpus)
 *     → Claude API (structured JSON analysis)
 *     → Zod Validation (strip forbidden decisions)
 *     → Deterministic Engine (Readiness / Dependency / Status)
 *     → Persist via app code (Claude never writes DB)
 */

export type ContextPack = {
  docs: { sourcePath: string; content: string; distance: number }[];
  github: Awaited<ReturnType<typeof fetchGitHubContext>>;
  figma: Awaited<ReturnType<typeof fetchFigmaContext>>;
};

const RAG_TOP_K = 6;

async function loadTeamCredentials(teamId: string) {
  const rows = await prisma.integrationCredential.findMany({ where: { teamId } });
  const map: Record<string, Record<string, string>> = {};
  for (const row of rows) {
    map[row.provider] = decryptJson(row.payload);
  }
  return {
    github: {
      token: map.github?.token ?? process.env.GITHUB_TOKEN ?? null,
      owner: map.github?.owner ?? process.env.GITHUB_OWNER ?? null,
      repo: map.github?.repo ?? process.env.GITHUB_REPO ?? null,
    },
    figma: {
      token: map.figma?.token ?? process.env.FIGMA_TOKEN ?? null,
      fileKey: map.figma?.fileKey ?? process.env.FIGMA_FILE_KEY ?? null,
    },
  };
}

/** Context Engine: retrieve ONLY relevant slices — never dump all docs. */
export async function buildContextPack(teamId: string, query: string): Promise<ContextPack> {
  const creds = await loadTeamCredentials(teamId);
  const [docs, github, figma] = await Promise.all([
    retrieveRelevantChunks(teamId, query, RAG_TOP_K),
    fetchGitHubContext({ ...creds.github, query }),
    fetchFigmaContext(creds.figma),
  ]);

  return {
    docs: docs.map((d) => ({
      sourcePath: d.sourcePath,
      content: d.content,
      distance: d.distance,
    })),
    github,
    figma,
  };
}

export async function runContextPipeline(task: Task) {
  // 1) Context Engine — assemble query from PM requirement
  const query = [
    task.title,
    task.requirement,
    task.description,
    JSON.stringify(task.businessRules ?? []),
    task.acceptanceCriteria,
    ...(task.internalDocPaths ?? []),
  ].join("\n");

  // 2) RAG — relevant context only
  const contextPack = await buildContextPack(task.teamId, query);

  // 3) Claude — structured analysis (no status/readiness/DB)
  const { analysis, raw, validationWarnings } = await analyzeTaskWithClaude({
    taskTitle: task.title,
    taskDescription: task.description,
    requirement: task.requirement,
    businessRules: task.businessRules,
    acceptanceCriteria: task.acceptanceCriteria,
    contextPack,
  });
  // 4) Validation already applied inside analyzeTaskWithClaude

  const deps = await prisma.taskDependency.findMany({
    where: { dependentId: task.id },
    include: {
      dependency: {
        include: { assignee: { select: { id: true, name: true } } },
      },
    },
  });
  const siblings = await prisma.task.findMany({
    where: { teamId: task.teamId, id: { not: task.id } },
    select: { id: true, title: true, status: true },
  });

  // 5) Deterministic Engine — owns readiness / dependency / status
  const engineOutput = runDeterministicEngine({
    task,
    dependencies: deps.map((d) => ({
      id: d.dependency.id,
      title: d.dependency.title,
      status: d.dependency.status,
      assigneeId: d.dependency.assigneeId,
      assigneeName: d.dependency.assignee?.name ?? null,
    })),
    analysis,
    siblingTitles: siblings,
  });

  for (const depId of engineOutput.suggestedDependencyIds) {
    await prisma.taskDependency.upsert({
      where: {
        dependentId_dependencyId: {
          dependentId: task.id,
          dependencyId: depId,
        },
      },
      create: {
        dependentId: task.id,
        dependencyId: depId,
        source: "engine",
      },
      update: {},
    });
  }

  // 6) Persist — application layer only (Claude never writes DB)
  const run = await prisma.contextRun.create({
    data: {
      teamId: task.teamId,
      taskId: task.id,
      query,
      contextPack: {
        ...contextPack,
        _rag: {
          topK: RAG_TOP_K,
          maxDistance: RAG_MAX_DISTANCE,
          chunksKept: contextPack.docs.length,
          fullCorpusSent: false,
        },
        _validationWarnings: validationWarnings,
      } as object,
      analysis: analysis as unknown as Prisma.InputJsonValue,
      claudeRaw: raw as object,
      engineOutput: engineOutput as object,
    },
  });

  // Optionally merge Claude rule candidates when task has none yet (suggestion → DB via app)
  const shouldSeedRules =
    parseBusinessRulesEmpty(task.businessRules) &&
    analysis.extractedBusinessRules.length > 0;

  const updated = await prisma.task.update({
    where: { id: task.id },
    data: {
      readinessScore: engineOutput.readinessScore,
      readinessNotes: engineOutput.readinessNotes,
      designLinked: engineOutput.designLinked,
      figmaReady: engineOutput.figmaReady,
      acPresent: engineOutput.acPresent,
      requirementPresent: engineOutput.requirementPresent,
      rulesPresent: engineOutput.rulesPresent,
      apiReady: engineOutput.apiReady,
      status: engineOutput.status,
      engineStatus: engineOutput.status,
      lastContextRunId: run.id,
      ...(shouldSeedRules
        ? {
            businessRules: analysis.extractedBusinessRules as unknown as Prisma.InputJsonValue,
          }
        : {}),
    },
  });

  await notifyFigmaReady(task, updated);
  await notifyMissingContext(task, updated, engineOutput.missingContext);

  // The engine may have moved this task (e.g. into done/review); anything
  // depending on it must be re-evaluated too.
  const cascade = updated.status !== task.status ? await cascadeFromTask(task.id) : [];

  const handoffDocs =
    engineOutput.status === "ready" || engineOutput.status === "assigned"
      ? await syncHandoffDocs(updated, analysis, engineOutput)
      : [];

  return {
    run,
    task: updated,
    cascade,
    analysis,
    engineOutput,
    contextPack,
    validationWarnings,
    handoffDocs,
  };
}

/** Generate role-scoped markdown handoff docs and persist them (upsert + prune stale roles). */
export async function syncHandoffDocs(
  task: Task,
  analysis: ClaudeTaskAnalysis,
  engineOutput: Pick<EngineOutput, "status" | "readinessScore" | "readinessNotes" | "waitingFor">,
): Promise<HandoffDoc[]> {
  const deps = await prisma.taskDependency.findMany({
    where: { dependentId: task.id },
    include: { dependency: { include: { assignee: { select: { name: true } } } } },
  });

  const { docs } = await generateHandoffDocs({
    taskTitle: task.title,
    description: task.description,
    requirement: task.requirement,
    businessRules: task.businessRules,
    acceptanceCriteria: task.acceptanceCriteria,
    figmaUrl: task.figmaUrl,
    figmaReady: task.figmaReady,
    githubIssueUrl: task.githubIssueUrl,
    githubPrUrl: task.githubPrUrl,
    internalDocPaths: task.internalDocPaths,
    dependencies: deps.map((d) => ({
      title: d.dependency.title,
      status: d.dependency.status,
      assigneeName: d.dependency.assignee?.name ?? null,
    })),
    analysis,
    engineOutput: {
      status: engineOutput.status,
      readinessScore: engineOutput.readinessScore,
      readinessNotes: engineOutput.readinessNotes,
      waitingFor: engineOutput.waitingFor,
    },
  });

  const roles = docs.map((d) => d.role);
  await Promise.all(
    docs.map((d) =>
      prisma.taskHandoff.upsert({
        where: { taskId_role: { taskId: task.id, role: d.role } },
        create: { taskId: task.id, role: d.role, title: d.title, content: d.content },
        update: { title: d.title, content: d.content },
      }),
    ),
  );
  if (roles.length > 0) {
    await prisma.taskHandoff.deleteMany({
      where: { taskId: task.id, role: { notIn: roles } },
    });
  }

  return docs;
}

/** Design just became implementable — tell whoever is going to build it. */
async function notifyFigmaReady(before: Task, after: Task) {
  if (after.figmaReady === before.figmaReady || !after.figmaReady || !after.assigneeId) return;

  await prisma.notification.create({
    data: {
      teamId: after.teamId,
      userId: after.assigneeId,
      taskId: after.id,
      type: "figma_ready",
      title: `🎨 Design ready: ${after.title}`,
      body: `${after.title} is ready for development.`,
    },
  });
}

/** Claude flagged context the requirement is missing — tell the PM who owns it. */
async function notifyMissingContext(before: Task, after: Task, missingContext: string[]) {
  if (missingContext.length === 0 || before.readinessNotes === after.readinessNotes) return;

  await prisma.notification.create({
    data: {
      teamId: after.teamId,
      userId: after.createdById,
      taskId: after.id,
      type: "missing_context",
      title: `⚠ Missing context: ${after.title}`,
      body: `${after.assigneeId ? "Dev is" : "Task is"} waiting for: ${missingContext.slice(0, 3).join("; ")}`,
    },
  });
}

function parseBusinessRulesEmpty(raw: unknown): boolean {
  if (raw == null) return true;
  if (Array.isArray(raw)) return raw.length === 0;
  return false;
}
