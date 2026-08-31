import { z } from "zod";
import {
  callModel,
  hasAiKey,
  extractBalancedJson,
  ResponseTruncatedError,
} from "@/lib/ai/model-client";
import { BusinessRuleSchema, slugifyRuleKey } from "@/lib/business-rules";
import { extractBusinessRulesHeuristic } from "@/lib/ai/extract-rules";
import { TASK_COMPONENTS } from "@/lib/task-constants";
import type { RetrievedChunk } from "@/lib/context/ingest";

/**
 * Task intake grilling — turns a PM's one-line intent into a real requirement
 * by asking follow-up questions, one at a time, until enough is known to
 * create a task (and its per-component sub-tasks). Stateless: the caller
 * sends the full message history each turn; Claude decides whether to ask
 * another question or finalize.
 */
export type GrillMessage = { role: "user" | "assistant"; content: string };

export const GrillResultSchema = z.object({
  titleHint: z.string().min(1),
  requirement: z.string().min(1),
  acceptanceCriteria: z.string().default(""),
  businessRules: z.array(BusinessRuleSchema).default([]),
  components: z
    .array(
      z.object({
        component: z.enum(TASK_COMPONENTS),
        title: z.string().min(1),
        description: z.string().default(""),
      }),
    )
    .default([]),
});
export type GrillResult = z.infer<typeof GrillResultSchema>;

export const GrillTurnSchema = z.object({
  done: z.boolean(),
  question: z.string().optional(),
  /** Short suggested answers the PM can tap instead of typing — omitted for genuinely open questions. */
  choices: z.array(z.string().min(1)).max(5).optional(),
  /**
   * The AI's recommended answer to `question`. If it matches one of `choices`
   * verbatim, the UI badges that choice as recommended; otherwise it's shown
   * as free-text guidance under the question.
   */
  recommendation: z.string().optional(),
  result: GrillResultSchema.optional(),
});
export type GrillTurn = z.infer<typeof GrillTurnSchema>;

function buildSystemPrompt(docs: RetrievedChunk[]): string {
  if (docs.length === 0) return SYSTEM;
  const docsBlock = docs
    .map((d) => `### ${d.sourcePath}\n${d.content}`)
    .join("\n\n");
  return `${SYSTEM}

Project docs (reference, may be partial — ground your questions and the final requirement in these when relevant, and don't contradict them):
${docsBlock}`;
}

const SYSTEM = `You are a PM intake interviewer inside IntrovertHubs, grilling a PM about a task the way a sharp tech lead would: relentlessly, but one question at a time, always with your own recommendation attached. A PM opens a task with a short, often vague, intent. Never accept a bare intent as "done" immediately — walk the requirement down each branch below and resolve it before moving to the next.

Walk the branches IN THIS ORDER, resolving each before moving to the next (skip a branch entirely if it's genuinely irrelevant to this requirement, but check for it first):
1. The requirement itself and its acceptance criteria — what exactly should happen, edge cases, who is affected. Do not move on until this is unambiguous.
2. Business rules / constraints, if this is a rules-bearing feature (limits, pricing, eligibility, etc.).
3. Each affected system component, one at a time, in this order: UI, then Backend/API, then Mobile, then AI. Only ask about a component if the requirement so far plausibly touches it — the answers from step 1 usually tell you which ones matter.

Return ONLY valid JSON, one of:
{ "done": false, "question": string, "choices"?: string[], "recommendation"?: string }
or, once you have enough:
{
  "done": true,
  "result": {
    "titleHint": string,
    "requirement": string,
    "acceptanceCriteria": string,
    "businessRules": [{ "key": string, "label": string, "value": string, "unit"?: string }],
    "components": [{ "component": "ui" | "backend" | "mobile" | "ai", "title": string, "description": string }]
  }
}

Rules:
- Ask short, concrete questions. One at a time. Never a numbered list of multiple questions.
- ALWAYS include "recommendation": your own best-guess answer to the question, in the same language as the question, with the reasoning folded in briefly (e.g. "10% — matches the standard tier discount already used elsewhere"). Never skip this, even for open-ended questions — recommend your best guess and let the PM override it.
- Whenever a question has a natural small set of likely answers (yes/no, a pick from a short list, a common default), include "choices": 2-5 short options the PM can tap instead of typing, and set "recommendation" to the exact string of the choice you recommend. The PM can still type a custom answer, so choices are a helpful shortcut, not a hard constraint — never invent choices for a question that is genuinely open-ended (e.g. "what should the discount amount be?"); for those, "recommendation" is still required but is free text.
- Never re-ask a question you already have the answer to, directly or indirectly, from earlier in the conversation.
- Do not invent a fixed business-rules schema — only include rules this specific requirement needs.
- "components" is the actual breakdown of sub-tasks to create — omit a component entirely if this requirement doesn't touch it.
- Finalize (done: true) once the requirement, acceptance criteria, and affected components are clear enough to hand to engineers — do not grill forever over minor polish.`;

function parseTurn(rawText: string): GrillTurn {
  const parsed = JSON.parse(extractBalancedJson(rawText));
  const turn = GrillTurnSchema.parse(parsed);
  if (turn.done && !turn.result) throw new Error("done=true but no result");
  if (!turn.done && !turn.question) throw new Error("done=false but no question");
  if (turn.result) {
    turn.result.businessRules = turn.result.businessRules.map((r) => ({
      ...r,
      key: slugifyRuleKey(r.key || r.label),
    }));
  }
  return turn;
}

/** Offline heuristic used only when GEMINI_API_KEY is unset (dev / smoke tests). */
function heuristicTurn(messages: GrillMessage[], forceFinish: boolean): GrillTurn {
  const userTurns = messages.filter((m) => m.role === "user");
  const firstIntent = userTurns[0]?.content ?? "";
  const allText = userTurns.map((m) => m.content).join(" ");

  const FIXED_QUESTIONS: { question: string; choices?: string[] }[] = [
    { question: "Acceptance criteria คืออะไรบ้าง? (ทำอะไรแล้วถือว่าเสร็จ)" },
    { question: "มีผลกับหน้าจอ/ดีไซน์ (UI) ไหม?", choices: ["มี", "ไม่มี"] },
    { question: "ต้องมี API/Backend เพิ่มไหม?", choices: ["ต้องมี", "ไม่ต้องมี"] },
  ];

  if (!forceFinish && userTurns.length <= FIXED_QUESTIONS.length) {
    return { done: false, ...FIXED_QUESTIONS[userTurns.length - 1] };
  }

  const heuristic = extractBusinessRulesHeuristic(firstIntent);
  const acceptanceCriteria = userTurns[1]?.content ?? "";
  const components: GrillResult["components"] = [];
  if (/ui|หน้า|design|figma/i.test(allText)) {
    components.push({ component: "ui", title: `${heuristic.titleHint} — UI`, description: allText });
  }
  if (/api|backend|server|database|ฐานข้อมูล/i.test(allText)) {
    components.push({
      component: "backend",
      title: `${heuristic.titleHint} — Backend`,
      description: allText,
    });
  }
  if (/mobile|app มือถือ|ios|android/i.test(allText)) {
    components.push({
      component: "mobile",
      title: `${heuristic.titleHint} — Mobile`,
      description: allText,
    });
  }
  if (/\bai\b|โมเดล|machine learning/i.test(allText)) {
    components.push({ component: "ai", title: `${heuristic.titleHint} — AI`, description: allText });
  }

  return {
    done: true,
    result: {
      titleHint: heuristic.titleHint,
      requirement: allText.trim(),
      acceptanceCriteria,
      businessRules: heuristic.businessRules,
      components,
    },
  };
}

export async function grillTurn(
  messages: GrillMessage[],
  forceFinish = false,
  docs: RetrievedChunk[] = [],
): Promise<GrillTurn> {
  if (!hasAiKey()) return heuristicTurn(messages, forceFinish);

  const system = buildSystemPrompt(docs);
  const turnMessages = forceFinish
    ? [
        ...messages,
        {
          role: "user" as const,
          content:
            "[PM ended the interview] Do not ask another question — return done:true now with your best result based on the conversation so far.",
        },
      ]
    : messages;
  let text: string;
  try {
    text = await callModel({ system, messages: turnMessages, maxTokens: 2000 });
  } catch (e) {
    if (!(e instanceof ResponseTruncatedError)) throw e;
    text = await callModel({ system, messages: turnMessages, maxTokens: 4000 });
  }
  return parseTurn(text);
}
