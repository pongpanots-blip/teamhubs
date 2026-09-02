import { z } from "zod";
import type { ClaudeTaskAnalysis } from "@/lib/ai/schemas";
import { parseBusinessRules, type BusinessRule } from "@/lib/business-rules";
import {
  callModel,
  hasAiKey,
  extractBalancedJson,
  ResponseTruncatedError,
} from "@/lib/ai/model-client";

/**
 * Handoff writer — splits a READY requirement into role-scoped markdown docs.
 *
 * Claude responsibilities here (ONLY):
 * - Rewrite the already-decided context into a doc per role (dev, design, …)
 *
 * Claude MUST NOT:
 * - Invent or change status / readinessScore (quoted verbatim from the engine)
 * - Invent business rules, dependencies, or links not present in the input
 */
export const HandoffDocSchema = z.object({
  role: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
});
export const HandoffDocsSchema = z.array(HandoffDocSchema);
export type HandoffDoc = z.infer<typeof HandoffDocSchema>;

const SYSTEM = `You are the handoff writer inside IntrovertHubs — NOT the decision brain.

You receive a task whose Deterministic Engine has already decided it is READY (or ASSIGNED),
plus the prior analysis. Split this into separate, concise markdown docs, one per role, so each
person can start immediately without asking anyone else.

Rules:
- Always produce a "dev" doc.
- Produce a "design" doc ONLY if a Figma link or figmaReady=true is present in the input.
- Quote status / readinessScore / waitingFor VERBATIM — never invent or recompute them.
- Do NOT invent business rules, dependencies, or links that are not present in the input.
- Each doc should cover (as relevant to that role): what to build, why, business rules, design/
  API/PR links, dependencies & owners, acceptance criteria, current status.
- Always include a "Repo & Design" section naming the project's registered repos (owner/name,
  branch, path prefix) and Figma files from \`projectRepos\`/\`projectFigmaFiles\`, even when this
  task has no PR or design link of its own yet — the next person (or AI) must know where to work
  without asking.

Return ONLY a valid JSON array:
[{ "role": string, "title": string, "content": string (markdown) }]`;

type DependencySummary = { title: string; status: string; assigneeName: string | null };

export type ProjectRepoSummary = {
  owner: string;
  name: string;
  defaultBranch: string;
  pathPrefix: string | null;
  isPrimary: boolean;
};

export type ProjectFigmaFileSummary = { name: string; isPrimary: boolean };

export type HandoffInput = {
  taskTitle: string;
  description: string;
  requirement: string;
  businessRules: unknown;
  acceptanceCriteria: string;
  figmaUrl: string | null;
  figmaReady: boolean;
  githubIssueUrl: string | null;
  githubPrUrl: string | null;
  internalDocPaths: string[];
  dependencies: DependencySummary[];
  /** The project's registered repos/Figma files — so the doc still says where
   * to work even when this task has no PR or design link of its own yet. */
  projectRepos: ProjectRepoSummary[];
  projectFigmaFiles: ProjectFigmaFileSummary[];
  analysis: ClaudeTaskAnalysis;
  engineOutput: {
    status: string;
    readinessScore: number;
    readinessNotes: string;
    waitingFor: string;
  };
};

function rulesToText(rules: BusinessRule[]): string {
  if (rules.length === 0) return "—";
  return rules.map((r) => `- ${r.label}: ${r.value}${r.unit ? ` ${r.unit}` : ""}`).join("\n");
}

function depsToText(deps: DependencySummary[]): string {
  if (deps.length === 0) return "—";
  return deps
    .map((d) => `- ${d.title} (${d.status}) · Owner: ${d.assigneeName ?? "Unassigned"}`)
    .join("\n");
}

function reposToText(repos: ProjectRepoSummary[]): string {
  if (repos.length === 0) return "—";
  return repos
    .map(
      (r) =>
        `- ${r.owner}/${r.name} (branch: ${r.defaultBranch}${r.pathPrefix ? `, path: ${r.pathPrefix}` : ""})${r.isPrimary ? " · primary" : ""}`,
    )
    .join("\n");
}

function figmaFilesToText(files: ProjectFigmaFileSummary[]): string {
  if (files.length === 0) return "—";
  return files.map((f) => `- ${f.name}${f.isPrimary ? " · primary" : ""}`).join("\n");
}

function offlineDevDoc(input: HandoffInput, rules: BusinessRule[]): HandoffDoc {
  const lines = [
    `# ${input.taskTitle} — Dev handoff`,
    "",
    `**Status:** ${input.engineOutput.status} · **Readiness:** ${input.engineOutput.readinessScore}%`,
    input.engineOutput.waitingFor ? `**Waiting for:** ${input.engineOutput.waitingFor}` : "",
    "",
    "## What to build",
    input.requirement || input.description || "—",
    "",
    "## Business rules",
    rulesToText(rules),
    "",
    "## Acceptance criteria",
    input.acceptanceCriteria || "—",
    "",
    "## Repo & Design",
    `Project repos:\n${reposToText(input.projectRepos)}`,
    `Figma files:\n${figmaFilesToText(input.projectFigmaFiles)}`,
    input.figmaUrl
      ? `This task's design: ${input.figmaUrl} (${input.figmaReady ? "ready" : "not ready"})`
      : "This task's design: not linked yet — see the project's Figma files above",
    "",
    "## API / GitHub",
    [input.githubIssueUrl, input.githubPrUrl].filter(Boolean).join("\n") || "—",
    "",
    "## Dependencies",
    depsToText(input.dependencies),
    "",
    "## Internal docs",
    input.internalDocPaths.length > 0 ? input.internalDocPaths.map((p) => `- ${p}`).join("\n") : "—",
  ].filter((l) => l !== "");
  return { role: "dev", title: `${input.taskTitle} — Dev`, content: lines.join("\n") };
}

function offlineDesignDoc(input: HandoffInput): HandoffDoc {
  const lines = [
    `# ${input.taskTitle} — Design handoff`,
    "",
    `**Status:** ${input.engineOutput.status}`,
    "",
    "## Figma",
    input.figmaUrl ? `${input.figmaUrl} (${input.figmaReady ? "ready for dev" : "not ready"})` : "—",
    `Project's Figma files:\n${figmaFilesToText(input.projectFigmaFiles)}`,
    "",
    "## Context",
    input.requirement || input.description || "—",
  ];
  return { role: "design", title: `${input.taskTitle} — Design`, content: lines.join("\n") };
}

export async function generateHandoffDocs(
  input: HandoffInput,
): Promise<{ docs: HandoffDoc[]; raw: unknown }> {
  const rules = parseBusinessRules(input.businessRules);

  if (!hasAiKey()) {
    const docs = [offlineDevDoc(input, rules)];
    if (input.figmaReady || input.figmaUrl) docs.push(offlineDesignDoc(input));
    return { docs, raw: docs };
  }

  const messages = [
    {
      role: "user" as const,
      content: JSON.stringify({
        task: {
          title: input.taskTitle,
          description: input.description,
          requirement: input.requirement,
          businessRules: rules,
          acceptanceCriteria: input.acceptanceCriteria,
          figmaUrl: input.figmaUrl,
          figmaReady: input.figmaReady,
          githubIssueUrl: input.githubIssueUrl,
          githubPrUrl: input.githubPrUrl,
          internalDocPaths: input.internalDocPaths,
          dependencies: input.dependencies,
          projectRepos: input.projectRepos,
          projectFigmaFiles: input.projectFigmaFiles,
        },
        analysis: input.analysis,
        engineOutput: input.engineOutput,
      }),
    },
  ];

  let text: string;
  try {
    text = await callModel({ system: SYSTEM, messages, maxTokens: 3072 });
  } catch (e) {
    if (!(e instanceof ResponseTruncatedError)) throw e;
    text = await callModel({ system: SYSTEM, messages, maxTokens: 6144 });
  }

  const raw = JSON.parse(extractBalancedJson(text));
  const docs = HandoffDocsSchema.parse(raw);
  return { docs, raw };
}
