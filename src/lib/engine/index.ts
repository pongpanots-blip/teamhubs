import type { Task, TaskStatus } from "@prisma/client";
import type { ClaudeTaskAnalysis } from "@/lib/ai/schemas";
import { parseBusinessRules } from "@/lib/business-rules";

/**
 * Deterministic Engine — the decision brain.
 * Owns: Readiness score, Status transitions, Dependency ID resolution.
 * Claude may only supply observations / candidates / questions.
 */
/** A dependency, with enough identity to say *what* we are waiting for and *who* owns it. */
export type EngineDependency = {
  id: string;
  title: string;
  status: TaskStatus;
  assigneeId: string | null;
  assigneeName: string | null;
};

export type EngineInput = {
  task: Task;
  dependencies: EngineDependency[];
  analysis: ClaudeTaskAnalysis;
  siblingTitles: { id: string; title: string; status: TaskStatus }[];
};

export type EngineOutput = {
  readinessScore: number;
  readinessNotes: string;
  designLinked: boolean;
  figmaReady: boolean;
  acPresent: boolean;
  requirementPresent: boolean;
  rulesPresent: boolean;
  apiReady: boolean;
  status: TaskStatus;
  /** Unfinished dependencies — the reason a task is blocked, and who to chase. */
  blockedBy: EngineDependency[];
  /** Human-readable "Waiting for X (Owner: Y)", empty when nothing blocks. */
  waitingFor: string;
  suggestedDependencyIds: string[];
  blockers: string[];
  /** Echo Claude advisory fields for UI (not decisions) */
  questionsForPm: string[];
  missingContext: string[];
  conflicts: { description: string; sources: string[] }[];
  contextSummary: string;
};

/** Dependencies that are not finished yet. Order preserved for stable output. */
export function unresolvedDependencies(deps: EngineDependency[]): EngineDependency[] {
  return deps.filter((d) => d.status !== "done");
}

export function describeWaitingFor(blocked: EngineDependency[]): string {
  if (blocked.length === 0) return "";
  return blocked
    .map((d) => `Waiting for ${d.title}${d.assigneeName ? ` (Owner: ${d.assigneeName})` : ""}`)
    .join("; ");
}

export function computeReadiness(input: EngineInput): Pick<
  EngineOutput,
  | "readinessScore"
  | "readinessNotes"
  | "designLinked"
  | "figmaReady"
  | "acPresent"
  | "requirementPresent"
  | "rulesPresent"
  | "apiReady"
> {
  const gaps = input.analysis.gapHints;
  const obs = input.analysis.observations;

  const requirementPresent =
    input.task.requirement.trim().length > 0 ||
    input.task.acceptanceCriteria.trim().length > 0;

  const acPresent =
    input.task.acceptanceCriteria.trim().length > 0 || Boolean(obs.acMentioned);

  const businessRules = parseBusinessRules(input.task.businessRules);
  // Final rules presence comes from task DB (PM-accepted), not Claude candidates alone
  const rulesPresent =
    businessRules.length > 0 || input.analysis.extractedBusinessRules.length > 0;

  const designLinked =
    Boolean(input.task.figmaUrl) || input.task.designLinked || Boolean(obs.designMentioned);

  const figmaReady =
    input.task.figmaReady || (designLinked && Boolean(obs.figmaReady));

  const apiReady = input.task.apiReady || Boolean(obs.apiReady);

  const blockedBy = unresolvedDependencies(input.dependencies);
  const depsOk = blockedBy.length === 0;
  const docsLinked =
    (input.task.internalDocPaths?.length ?? 0) > 0 || Boolean(obs.docsCoverRequirement);

  let score = 0;
  const notes: string[] = [];

  if (requirementPresent) score += 20;
  else notes.push("Missing requirement");

  if (acPresent) score += 15;
  else notes.push("Missing acceptance criteria");

  if (rulesPresent) score += 15;
  else notes.push("Business rules incomplete");

  if (designLinked) score += 10;
  else notes.push("Figma not linked");

  if (figmaReady) score += 10;
  else if (designLinked) notes.push("Figma not marked ready");

  if (apiReady) score += 10;
  else notes.push("API readiness unknown/false");

  if (depsOk) score += 10;
  else notes.push(describeWaitingFor(blockedBy));

  if (docsLinked) score += 10;
  else notes.push("No internal docs linked");

  // Conflicts / missing context from Claude reduce score deterministically
  if (input.analysis.conflicts.length > 0) {
    score = Math.max(0, score - 10 * Math.min(input.analysis.conflicts.length, 3));
    notes.push(`${input.analysis.conflicts.length} conflict(s) flagged`);
  }
  if (input.analysis.missingContext.length > 0) {
    notes.push(`Missing context: ${input.analysis.missingContext.slice(0, 3).join("; ")}`);
  }
  if (gaps.notes?.length) notes.push(...gaps.notes);

  return {
    readinessScore: score,
    readinessNotes: notes.join("; ") || "Ready checks passed",
    designLinked,
    figmaReady,
    acPresent,
    requirementPresent,
    rulesPresent,
    apiReady,
  };
}

/**
 * Status is owned here — Claude never sets it.
 * Assigned ≠ Working.
 */
export function computeStatus(input: EngineInput, readinessScore: number): TaskStatus {
  const current = input.task.status;
  if (current === "done") return "done";

  const obs = input.analysis.observations;
  const hasBlockingConflict = input.analysis.conflicts.length > 0;
  const hasBlockers = input.analysis.blockers.length > 0 || hasBlockingConflict;

  /*
   * An unfinished dependency is a HARD gate, not a score deduction. A task whose
   * every other check passes still scores 90 — high enough to read as "assigned"
   * — while the work it depends on is not merged. Dependencies decide first.
   */
  if (unresolvedDependencies(input.dependencies).length > 0) return "blocked";

  if (hasBlockers && readinessScore < 50) return "blocked";

  if (current === "working") return "working";
  if (current === "review" || obs.hasOpenPr) return "review";

  if (readinessScore < 70) return "not_ready";

  if (input.task.assigneeId) return "assigned";

  return "ready";
}

export function resolveSuggestedDependencies(input: EngineInput): string[] {
  const ids: string[] = [];
  for (const sug of input.analysis.suggestedDeps) {
    const hint = sug.taskTitleHint.toLowerCase();
    const match = input.siblingTitles.find(
      (t) =>
        t.id !== input.task.id &&
        (t.title.toLowerCase().includes(hint) || hint.includes(t.title.toLowerCase())),
    );
    if (match) ids.push(match.id);
  }
  return [...new Set(ids)];
}

export function runDeterministicEngine(input: EngineInput): EngineOutput {
  const readiness = computeReadiness(input);
  const status = computeStatus(input, readiness.readinessScore);
  const suggestedDependencyIds = resolveSuggestedDependencies(input);
  const blockedBy = unresolvedDependencies(input.dependencies);
  return {
    ...readiness,
    status,
    blockedBy,
    waitingFor: describeWaitingFor(blockedBy),
    suggestedDependencyIds,
    blockers: input.analysis.blockers,
    questionsForPm: input.analysis.questionsForPm,
    missingContext: input.analysis.missingContext,
    conflicts: input.analysis.conflicts,
    contextSummary: input.analysis.contextSummary || input.analysis.summary || "",
  };
}
