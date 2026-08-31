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

export const TASK_PRIORITIES = ["p0", "p1", "p2", "p3"] as const;

export const GrillResultSchema = z.object({
  titleHint: z.string().min(1),
  requirement: z.string().min(1),
  acceptanceCriteria: z.string().default(""),
  businessRules: z.array(BusinessRuleSchema).default([]),
  priority: z.enum(TASK_PRIORITIES).default("p2"),
  /** ISO date (YYYY-MM-DD), or "" when the PM has no deadline in mind. */
  deadline: z.string().default(""),
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
  // The model has no clock — without this, "สิ้นเดือนนี้" resolves to a date
  // from its training data.
  const today = `${SYSTEM}

Today's date is ${new Date().toISOString().slice(0, 10)}. Resolve any relative deadline the PM gives ("สิ้นเดือนนี้", "อีก 2 สัปดาห์") against it.`;
  if (docs.length === 0) return today;
  const docsBlock = docs
    .map((d) => `### ${d.sourcePath}\n${d.content}`)
    .join("\n\n");
  return `${today}

Project docs (reference, may be partial — ground your questions and the final requirement in these when relevant, and don't contradict them):
${docsBlock}`;
}

const SYSTEM = `You are a PM intake interviewer inside IntrovertHubs, grilling a PM about a task the way a sharp tech lead would: relentlessly, but one question at a time, always with your own recommendation attached. A PM opens a task with a short, often vague, intent. Never accept a bare intent as "done" immediately — walk the requirement down each branch below and resolve it before moving to the next.

Walk the branches IN THIS ORDER, resolving each before moving to the next (skip a branch entirely if it's genuinely irrelevant to this requirement, but check for it first):
1. The requirement itself and its acceptance criteria — what exactly should happen, edge cases, who is affected. Do not move on until this is unambiguous.
2. Business rules / constraints, if this is a rules-bearing feature (limits, pricing, eligibility, etc.).
3. Which parts of the system this touches. Ask it outright as one question with choices — "งานนี้ต้องแตะส่วนไหนบ้าง?" with choices drawn from UI / Web-API (Backend) / Mobile / AI — recommending the set you believe is right from the answers so far. The PM may name several; treat their answer as the definitive component list. Then, for each part they picked, ask one short question about what specifically has to change there.
4. Priority — ask it as choices: "P0 — ด่วนที่สุด หยุดงานอื่นได้" / "P1 — สำคัญ ทำรอบนี้" / "P2 — ปกติ" / "P3 — ไว้ก่อนได้", recommending one.
5. Deadline — ask when it needs to be done. Accept a plain date or "ไม่มีกำหนด"; convert whatever they say into an ISO date (YYYY-MM-DD) for the result, or "" if there is none.

Depth is the point. A bare intent like "อยากได้ feature การส่ง orders" is the START of branch 1, not the end of it. Before leaving branch 1, you must know, for this specific requirement:
- who does it (which role / user type), and from where in the product
- what information they have to provide, and which parts are required vs optional
- what the system does right after — what they see, who gets notified, what state the thing lands in
- what they can still do afterwards (edit / cancel / repeat), and until when
- what is NOT allowed, and what the user sees when they hit that or when it fails
Ask each of those as its own short question, in plain product language. Typically that means 5-8 questions before branch 1 is settled — do not jump to the component questions after two or three answers. Only skip one of these when the conversation has already answered it.

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
    "priority": "p0" | "p1" | "p2" | "p3",
    "deadline": string,
    "components": [{ "component": "ui" | "backend" | "mobile" | "ai", "title": string, "description": string }]
  }
}

Rules:
- Ask short, concrete questions. One at a time. Never a numbered list of multiple questions, and never two questions joined by "และ"/"and" in one sentence (e.g. "เกิดขึ้นตอนไหน และใครเป็นคนใช้") — pick the single most useful one and save the rest for later turns.
- Before every question, re-read the whole conversation and drop anything already answered — including answers that came out of a compound question, or that are plainly implied by what the PM said. "ตอนลงทะเบียนสมัครสมาชิก" already answers both when and who; asking "ระบบควรเช็คตอนไหน?" after that is a repeat, even though the wording differs. Repeating a settled point is the worst failure mode here — when in doubt, move to the next unanswered item in the depth list.
- Never ask the PM for engineering artifacts by name (e.g. "acceptance criteria คืออะไร", "business rules มีอะไรบ้าง", "edge case คืออะไร"). The PM often does not think in those terms. Ask in plain product language about what the user should be able to do, or propose a draft yourself and ask them to confirm or correct it.
- ALWAYS include "recommendation": your own best-guess answer to the question, in the same language as the question, with the reasoning folded in briefly (e.g. "10% — matches the standard tier discount already used elsewhere"). Never skip this, even for open-ended questions — recommend your best guess and let the PM override it.
- Whenever a question has a natural small set of likely answers (yes/no, a pick from a short list, a common default), include "choices": 2-5 short options the PM can tap instead of typing, and set "recommendation" to the exact string of the choice you recommend. The PM can still type a custom answer, so choices are a helpful shortcut, not a hard constraint — never invent choices for a question that is genuinely open-ended (e.g. "what should the discount amount be?"); for those, "recommendation" is still required but is free text.
- If the PM says they don't know / aren't sure / "แล้วแต่คุณ", never re-ask that question and never stall. Adopt your own "recommendation" as the answer, state it back in one short line as the assumed answer, and immediately move on to the next branch. Then keep narrowing with easier questions — prefer yes/no or short "choices" the PM can just tap, and let the finalized requirement carry your assumptions.
- Do not invent a fixed business-rules schema — only include rules this specific requirement needs.
- "components" is the actual breakdown of sub-tasks to create — omit a component entirely if this requirement doesn't touch it.
- Never finalize before you have asked branches 3, 4 and 5 — the component list, the priority, and the deadline are required, even when the rest of the requirement is already clear.
- Finalize (done: true) only once you could hand this to an engineer who has never heard of it and they would not have to come back with a question — every point in the depth list above is answered or explicitly assumed. Do not finalize just because the PM gave a few answers; equally, do not grill forever over minor polish once the picture is complete.`;

/**
 * The model occasionally drops the `done` flag, or returns a bare result object
 * with no envelope at all. Both are unambiguous from the shape, so infer rather
 * than failing the turn.
 */
function normalizeTurn(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return parsed;
  const obj = { ...(parsed as Record<string, unknown>) };
  if (!("done" in obj) && !("result" in obj) && "titleHint" in obj && "requirement" in obj) {
    return { done: true, result: obj };
  }
  if (typeof obj.done !== "boolean") {
    if (obj.result) obj.done = true;
    else if (typeof obj.question === "string") obj.done = false;
  }
  return obj;
}

/** Errors from turning model text into a GrillTurn — worth one retry, unlike a network/auth failure. */
function isParseFailure(e: unknown): boolean {
  return e instanceof z.ZodError || (e instanceof Error && /JSON|done=true|done=false/.test(e.message));
}

function parseTurn(rawText: string): GrillTurn {
  const parsed = normalizeTurn(JSON.parse(extractBalancedJson(rawText)));
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

/** Answers that mean "I don't know" — treated as no answer, not as content. */
const DONT_KNOW_RE = /^(ไม่รู้|ยังไม่รู้|ไม่แน่ใจ|ไม่ทราบ|แล้วแต่|ไม่มี|skip|idk|dunno|don'?t know|not sure)\b/i;

/** Offline heuristic used only when GEMINI_API_KEY is unset (dev / smoke tests). */
function heuristicTurn(messages: GrillMessage[], forceFinish: boolean): GrillTurn {
  const userTurns = messages.filter((m) => m.role === "user");
  const firstIntent = userTurns[0]?.content ?? "";
  const allText = userTurns.map((m) => m.content).join(" ");

  type FixedQuestion = { question: string; choices?: string[]; recommendation?: string };
  // Offline stand-in for the model: walks the same branches the system prompt
  // describes — what/who/where, then the data, the after-state, the limits,
  // then the components — instead of stopping at a single "what happens" question.
  const FIXED_QUESTIONS: FixedQuestion[] = [
    {
      question:
        "ถ้าฟีเจอร์นี้เสร็จแล้ว ผู้ใช้จะทำอะไรได้บ้าง? เล่าสั้น ๆ ตามที่นึกออกพอ เดี๋ยวเราสรุปเป็นเช็กลิสต์ให้เอง",
      recommendation: "ผู้ใช้ทำงานนี้จบได้เองในระบบ ไม่ต้องให้ทีมงานทำให้",
    },
    {
      question: "ใครเป็นคนใช้ฟีเจอร์นี้?",
      choices: ["ลูกค้า", "พนักงานภายใน", "ทั้งสองฝั่ง"],
      recommendation: "ลูกค้า",
    },
    {
      question: "ผู้ใช้เข้าถึงจากตรงไหนของระบบ? (หน้าไหน / กดจากอะไร)",
      recommendation: "ปุ่มในหน้าหลักของส่วนที่เกี่ยวข้อง — หาเจอง่ายที่สุด",
    },
    {
      question: "ตอนทำรายการ ต้องกรอก/เลือกข้อมูลอะไรบ้าง? อันไหนบังคับ อันไหนไม่บังคับ",
      recommendation: "บังคับเฉพาะข้อมูลที่ระบบทำงานต่อไม่ได้ถ้าขาด ที่เหลือให้ข้ามได้",
    },
    {
      question: "กดยืนยันแล้วเกิดอะไรขึ้นต่อ? ผู้ใช้เห็นอะไร และมีใครต้องได้รับแจ้งไหม?",
      recommendation: "เห็นหน้าสรุปว่าสำเร็จ + แจ้งเตือนคนที่ต้องรับงานต่อ",
    },
    {
      question: "หลังส่งแล้ว ผู้ใช้ยังแก้ไข/ยกเลิกได้ไหม?",
      choices: ["แก้ไขได้", "ยกเลิกได้อย่างเดียว", "แก้ไม่ได้เลย"],
      recommendation: "ยกเลิกได้อย่างเดียว",
    },
    {
      question: "มีข้อจำกัดอะไรที่ห้ามทำไหม? (เช่น จำนวนขั้นต่ำ/สูงสุด เวลาที่ทำได้ สิทธิ์การเข้าถึง)",
      recommendation: "ยังไม่กำหนดข้อจำกัดในรอบแรก แล้วค่อยเพิ่มทีหลังถ้าเจอปัญหา",
    },
    {
      question: "ถ้าทำรายการไม่สำเร็จ ผู้ใช้ควรเห็นอะไร?",
      recommendation: "ข้อความบอกสาเหตุที่อ่านรู้เรื่อง + ปุ่มให้ลองใหม่ โดยข้อมูลที่กรอกไว้ไม่หาย",
    },
    { question: "มีผลกับหน้าจอ/ดีไซน์ (UI) ไหม?", choices: ["มี", "ไม่มี"], recommendation: "มี" },
    {
      question: "ต้องมี API/Backend เพิ่มไหม?",
      choices: ["ต้องมี", "ไม่ต้องมี"],
      recommendation: "ต้องมี",
    },
    {
      question: "ต้องทำบนแอปมือถือด้วยไหม?",
      choices: ["ต้องทำ", "ยังไม่ต้อง"],
      recommendation: "ยังไม่ต้อง",
    },
    {
      question: "งานนี้ด่วนแค่ไหน?",
      choices: [
        "P0 — ด่วนที่สุด หยุดงานอื่นได้",
        "P1 — สำคัญ ทำรอบนี้",
        "P2 — ปกติ",
        "P3 — ไว้ก่อนได้",
      ],
      recommendation: "P2 — ปกติ",
    },
    {
      question: "ต้องเสร็จเมื่อไหร่? (ระบุวันที่ เช่น 2026-09-30 หรือตอบว่าไม่มีกำหนด)",
      choices: ["ไม่มีกำหนด"],
      recommendation: "ไม่มีกำหนด",
    },
  ];

  if (!forceFinish && userTurns.length <= FIXED_QUESTIONS.length) {
    return { done: false, ...FIXED_QUESTIONS[userTurns.length - 1] };
  }

  const heuristic = extractBusinessRulesHeuristic(firstIntent);
  const acAnswer = userTurns[1]?.content ?? "";
  const acceptanceCriteria = DONT_KNOW_RE.test(acAnswer.trim())
    ? `(PM ยังไม่ระบุ — ตั้งต้นจาก intent) ${firstIntent}`.trim()
    : acAnswer;
  const components: GrillResult["components"] = [];
  // Answers to the component questions above (offset by the leading intent turn).
  const answeredYes = (questionIndex: number, no: RegExp) => {
    const a = userTurns[questionIndex + 1]?.content?.trim();
    return a ? !no.test(a) : false;
  };
  const wantsUi = answeredYes(8, /^ไม่มี/);
  const wantsBackend = answeredYes(9, /^ไม่ต้อง/);
  const wantsMobile = answeredYes(10, /^ยังไม่ต้อง/);
  if (wantsUi || /ui|หน้า|design|figma/i.test(allText)) {
    components.push({ component: "ui", title: `${heuristic.titleHint} — UI`, description: allText });
  }
  if (wantsBackend || /api|backend|server|database|ฐานข้อมูล/i.test(allText)) {
    components.push({
      component: "backend",
      title: `${heuristic.titleHint} — Backend`,
      description: allText,
    });
  }
  if (wantsMobile || /mobile|app มือถือ|ios|android/i.test(allText)) {
    components.push({
      component: "mobile",
      title: `${heuristic.titleHint} — Mobile`,
      description: allText,
    });
  }
  if (/\bai\b|โมเดล|machine learning/i.test(allText)) {
    components.push({ component: "ai", title: `${heuristic.titleHint} — AI`, description: allText });
  }

  const priorityAnswer = userTurns[12]?.content ?? "";
  const priority =
    (TASK_PRIORITIES.find((p) => priorityAnswer.toLowerCase().startsWith(p)) ?? "p2");
  const deadlineAnswer = userTurns[13]?.content ?? "";
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(deadlineAnswer.trim()) ? deadlineAnswer.trim() : "";

  return {
    done: true,
    result: {
      titleHint: heuristic.titleHint,
      requirement: allText.trim(),
      acceptanceCriteria,
      businessRules: heuristic.businessRules,
      priority,
      deadline,
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
  // A first pass occasionally comes back truncated, or empty with no usable
  // JSON at all. Both are recoverable by retrying once with more room.
  try {
    return parseTurn(await callModel({ system, messages: turnMessages, maxTokens: 2000 }));
  } catch (e) {
    if (e instanceof SyntaxError || e instanceof ResponseTruncatedError || isParseFailure(e)) {
      return parseTurn(await callModel({ system, messages: turnMessages, maxTokens: 4000 }));
    }
    throw e;
  }
}
