import type { ClaudeTaskAnalysis } from "@/lib/ai/schemas";
import { validateClaudeAnalysis } from "@/lib/ai/validate";
import { parseBusinessRules, type BusinessRule } from "@/lib/business-rules";
import { callModel, hasAiKey, extractBalancedJson, ResponseTruncatedError } from "@/lib/ai/model-client";

/**
 * Claude responsibilities (ONLY):
 * - อ่าน Requirement ภาษาคน
 * - Extract Business Rules (candidates)
 * - หา Missing Context
 * - วิเคราะห์ Conflict
 * - สรุป Context
 * - Generate คำถามให้ PM
 * - วิเคราะห์เอกสารที่เกี่ยวข้อง (จาก RAG snippets เท่านั้น)
 *
 * Claude MUST NOT:
 * - ตัดสิน Business Rule เอง (final)
 * - เปลี่ยน Status เอง
 * - คำนวณ Readiness เอง
 * - เขียน DB โดยตรง
 * - รับ Internal Docs ทั้งก้อนเข้า prompt
 */
const SYSTEM = `You are an analysis layer inside IntrovertHubs — NOT the decision brain.

You receive: a PM requirement, optional existing BusinessRules[], and a SMALL retrieved context pack (RAG snippets + optional GitHub/Figma metadata).
You never receive the full documentation corpus.

Return ONLY valid JSON:
{
  "contextSummary": string,
  "extractedBusinessRules": [{ "key": string, "label": string, "value": string, "unit"?: string }],
  "missingContext": string[],
  "conflicts": [{ "description": string, "sources": string[] }],
  "questionsForPm": string[],
  "relatedDocInsights": [{ "sourcePath": string, "insight": string }],
  "blockers": string[],
  "suggestedDeps": [{ "taskTitleHint": string, "reason": string }],
  "observations": {
    "hasOpenPr"?: boolean,
    "hasOpenIssue"?: boolean,
    "designMentioned"?: boolean,
    "figmaReady"?: boolean,
    "acMentioned"?: boolean,
    "apiReady"?: boolean,
    "docsCoverRequirement"?: boolean
  },
  "gapHints": {
    "missingAc"?: boolean,
    "missingDesign"?: boolean,
    "missingDeps"?: boolean,
    "missingRequirement"?: boolean,
    "missingRules"?: boolean,
    "missingDocs"?: boolean,
    "notes": string[]
  }
}

Hard rules:
- Do NOT output status, readinessScore, or DB writes.
- Do NOT invent final business policy — extractedBusinessRules are candidates for review.
- Do NOT claim you read docs that are not in the context pack.
- Prefer empty arrays over guesses.
- Assigned ≠ Working is enforced elsewhere; do not decide status.`;

function rulesToText(rules: BusinessRule[]): string {
  return rules.map((r) => `${r.label}: ${r.value}${r.unit ? ` ${r.unit}` : ""}`).join("\n");
}

/** Truncate RAG snippets so we never dump whole docs into the prompt. */
export function slimContextPackForPrompt(contextPack: {
  docs?: { sourcePath: string; content: string; distance?: number }[];
  github?: unknown;
  figma?: unknown;
}) {
  const docs = (contextPack.docs ?? []).slice(0, 6).map((d) => ({
    sourcePath: d.sourcePath,
    // hard cap per chunk
    content: d.content.length > 900 ? `${d.content.slice(0, 900)}…` : d.content,
    distance: d.distance,
  }));
  return {
    docs,
    github: contextPack.github ?? null,
    figma: contextPack.figma ?? null,
    _meta: {
      docChunks: docs.length,
      note: "Retrieved snippets only — full internal docs corpus was NOT sent",
    },
  };
}

export async function analyzeTaskWithClaude(input: {
  taskTitle: string;
  taskDescription: string;
  requirement: string;
  businessRules: unknown;
  acceptanceCriteria: string;
  contextPack: {
    docs?: { sourcePath: string; content: string; distance?: number }[];
    github?: unknown;
    figma?: unknown;
  };
}): Promise<{ analysis: ClaudeTaskAnalysis; raw: unknown; validationWarnings: string[] }> {
  const businessRules = parseBusinessRules(input.businessRules);
  const rulesText = rulesToText(businessRules);
  const slimPack = slimContextPackForPrompt(input.contextPack);

  if (!hasAiKey()) {
    const hasDocs = (slimPack.docs?.length ?? 0) > 0;
    const hasDesign =
      Boolean((slimPack.figma as { name?: string } | null)?.name) ||
      /figma/i.test(input.taskDescription + input.requirement);
    const hasAc = input.acceptanceCriteria.trim().length > 0;
    const hasReq = input.requirement.trim().length > 0 || hasAc;
    const hasRules = businessRules.length > 0;
    const raw = {
      contextSummary: `Offline analysis for "${input.taskTitle}". Docs snippets=${hasDocs}.`,
      extractedBusinessRules: businessRules,
      missingContext: [
        ...(!hasAc ? ["Acceptance criteria"] : []),
        ...(!hasRules ? ["Business rules"] : []),
        ...(!hasDocs ? ["Related internal docs"] : []),
      ],
      conflicts: [],
      questionsForPm: [
        ...(!hasAc
          ? ["ถ้างานนี้เสร็จแล้ว ผู้ใช้จะทำอะไรได้บ้าง? เล่าสั้น ๆ พอ"]
          : []),
        ...(!hasRules ? ["มีตัวเลขหรือเงื่อนไขอะไรที่ต้องยึดไหม เช่น จำนวน วัน หรือเปอร์เซ็นต์?"] : []),
      ],
      relatedDocInsights: (slimPack.docs ?? []).slice(0, 3).map((d) => ({
        sourcePath: d.sourcePath,
        insight: "Retrieved as relevant to the requirement query",
      })),
      blockers: hasReq ? [] : ["Requirement missing"],
      suggestedDeps: [],
      observations: {
        designMentioned: hasDesign,
        figmaReady: hasDesign,
        acMentioned: hasAc,
        apiReady: /api/i.test(input.requirement + rulesText),
        hasOpenIssue: Boolean(
          ((slimPack.github as { issues?: unknown[] } | null)?.issues ?? []).length,
        ),
        hasOpenPr: Boolean(
          ((slimPack.github as { pulls?: unknown[] } | null)?.pulls ?? []).length,
        ),
        docsCoverRequirement: hasDocs,
      },
      gapHints: {
        missingAc: !hasAc,
        missingDesign: !hasDesign,
        missingDeps: false,
        missingRequirement: !hasReq,
        missingRules: !hasRules,
        missingDocs: !hasDocs,
        notes: hasDocs ? ["Relevant docs retrieved via RAG"] : ["No docs retrieved"],
      },
    };
    const { analysis, warnings } = validateClaudeAnalysis(raw);
    return { analysis, raw, validationWarnings: warnings };
  }

  const messages = [
    {
      role: "user" as const,
      content: JSON.stringify({
        task: {
          title: input.taskTitle,
          description: input.taskDescription,
          requirement: input.requirement,
          businessRules,
          acceptanceCriteria: input.acceptanceCriteria,
        },
        contextPack: slimPack,
      }),
    },
  ];

  // 4096 covers normal responses; if the model still hits the ceiling (rare —
  // a very large RAG context pack can push it there), retry once with more
  // headroom rather than surfacing a confusing JSON-parse error to the caller.
  let text: string;
  try {
    text = await callModel({ system: SYSTEM, messages, maxTokens: 4096 });
  } catch (e) {
    if (!(e instanceof ResponseTruncatedError)) throw e;
    text = await callModel({ system: SYSTEM, messages, maxTokens: 8192 });
  }

  const raw = JSON.parse(extractBalancedJson(text));
  const { analysis, warnings } = validateClaudeAnalysis(raw);
  return { analysis, raw, validationWarnings: warnings };
}
