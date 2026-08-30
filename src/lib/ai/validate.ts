import { ClaudeTaskAnalysisSchema, type ClaudeTaskAnalysis } from "@/lib/ai/schemas";

const FORBIDDEN_TOP_LEVEL = [
  "status",
  "readinessScore",
  "readiness",
  "engineStatus",
  "assigneeId",
  "writeDb",
  "sql",
] as const;

/**
 * Validate Claude JSON and strip anything that would let Claude act as the brain.
 * - Rejects / ignores status & readiness decisions
 * - Caps list sizes so prompts/results stay bounded
 */
export function validateClaudeAnalysis(raw: unknown): {
  analysis: ClaudeTaskAnalysis;
  warnings: string[];
} {
  const warnings: string[] = [];
  const obj =
    raw && typeof raw === "object" ? { ...(raw as Record<string, unknown>) } : {};

  for (const key of FORBIDDEN_TOP_LEVEL) {
    if (key in obj) {
      warnings.push(`Stripped forbidden Claude field: ${key}`);
      delete obj[key];
    }
  }

  // Legacy field remaps
  if (!obj.contextSummary && typeof obj.summary === "string") {
    obj.contextSummary = obj.summary;
  }
  if (!obj.observations && obj.statusSignals) {
    const signals = obj.statusSignals as Record<string, unknown>;
    if ("suggestedStatus" in signals) {
      warnings.push("Ignored Claude suggestedStatus (Deterministic Engine owns status)");
      delete signals.suggestedStatus;
    }
    obj.observations = signals;
    delete obj.statusSignals;
  }
  if (!obj.gapHints && obj.readinessHints) {
    obj.gapHints = obj.readinessHints;
    delete obj.readinessHints;
  }

  const parsed = ClaudeTaskAnalysisSchema.safeParse(obj);
  if (!parsed.success) {
    throw new Error(`Claude JSON validation failed: ${parsed.error.message}`);
  }

  const analysis: ClaudeTaskAnalysis = {
    ...parsed.data,
    missingContext: parsed.data.missingContext.slice(0, 12),
    conflicts: parsed.data.conflicts.slice(0, 8),
    questionsForPm: parsed.data.questionsForPm.slice(0, 10),
    relatedDocInsights: parsed.data.relatedDocInsights.slice(0, 8),
    blockers: parsed.data.blockers.slice(0, 12),
    suggestedDeps: parsed.data.suggestedDeps.slice(0, 8),
    extractedBusinessRules: parsed.data.extractedBusinessRules.slice(0, 30),
  };

  return { analysis, warnings };
}
