import { z } from "zod";
import { BusinessRuleSchema } from "@/lib/business-rules";

/**
 * Claude output contract — analysis only.
 * Claude MUST NOT: decide final business rules, change status, score readiness, or write DB.
 * Observational signals are hints for the Deterministic Engine, not decisions.
 */
export const ClaudeTaskAnalysisSchema = z.object({
  /** สรุป context ที่เกี่ยวข้องหลังอ่าน requirement + RAG snippets */
  contextSummary: z.string(),
  /** @deprecated use contextSummary — kept for older runs */
  summary: z.string().optional(),
  /** Extracted / refined business rule candidates (suggestions only) */
  extractedBusinessRules: z.array(BusinessRuleSchema).default([]),
  /** สิ่งที่ยังขาดจาก requirement / docs / integrations */
  missingContext: z.array(z.string()).default([]),
  /** ความขัดแย้งระหว่าง requirement, rules, หรือ docs */
  conflicts: z
    .array(
      z.object({
        description: z.string(),
        sources: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  /** คำถามที่ควรถาม PM เพื่อปิดช่องว่าง */
  questionsForPm: z.array(z.string()).default([]),
  /** วิเคราะห์เอกสารที่เกี่ยวข้อง (จาก RAG เท่านั้น) */
  relatedDocInsights: z
    .array(
      z.object({
        sourcePath: z.string(),
        insight: z.string(),
      }),
    )
    .default([]),
  /** Potential blockers as findings — engine decides BLOCKED */
  blockers: z.array(z.string()).default([]),
  /** Dependency hints by title — engine resolves to IDs */
  suggestedDeps: z
    .array(
      z.object({
        taskTitleHint: z.string(),
        reason: z.string(),
      }),
    )
    .default([]),
  /** Facts observed in context — never final status */
  observations: z
    .object({
      hasOpenPr: z.boolean().optional(),
      hasOpenIssue: z.boolean().optional(),
      designMentioned: z.boolean().optional(),
      figmaReady: z.boolean().optional(),
      acMentioned: z.boolean().optional(),
      apiReady: z.boolean().optional(),
      docsCoverRequirement: z.boolean().optional(),
    })
    .default({}),
  /** Soft gaps for the readiness engine (engine scores, not Claude) */
  gapHints: z
    .object({
      missingAc: z.boolean().optional(),
      missingDesign: z.boolean().optional(),
      missingDeps: z.boolean().optional(),
      missingRequirement: z.boolean().optional(),
      missingRules: z.boolean().optional(),
      missingDocs: z.boolean().optional(),
      notes: z.array(z.string()).default([]),
    })
    .default({ notes: [] }),
});

export type ClaudeTaskAnalysis = z.infer<typeof ClaudeTaskAnalysisSchema>;

/** Compatibility view used by older engine code paths */
export function asEngineHints(analysis: ClaudeTaskAnalysis) {
  return {
    ...analysis,
    summary: analysis.contextSummary || analysis.summary || "",
    statusSignals: analysis.observations,
    readinessHints: analysis.gapHints,
  };
}
