import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMembership, requireProjectBySlug } from "@/lib/auth-session";
import { errorResponse } from "@/lib/api-error";
import { grillTurn } from "@/lib/ai/grill";
import { hasAiKey } from "@/lib/ai/model-client";
import { retrieveRelevantChunks } from "@/lib/context/ingest";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
    .min(1),
  forceFinish: z.boolean().optional(),
  /** Project the draft was started in — same project the finished draft will be created under. */
  projectSlug: z.string().min(1),
});

/**
 * One turn of the PM intake interview. Stateless — the client sends the full
 * conversation so far; we return either the next question or the final
 * structured result (requirement + business rules + per-component breakdown).
 */
export async function POST(req: Request) {
  try {
    const cx = await requireMembership();
    const body = schema.parse(await req.json());
    const { project } = await requireProjectBySlug(cx, body.projectSlug);

    const query = body.messages.map((m) => m.content).join("\n");
    const docs = query.trim() ? await retrieveRelevantChunks(project.id, query) : [];

    const turn = await grillTurn(body.messages, body.forceFinish, docs);
    // The PM should know when "AI" is actually a fixed offline script (no
    // GEMINI_API_KEY configured) — the questions and finalized result are
    // much dumber than the real model.
    return NextResponse.json({ ...turn, offline: !hasAiKey() });
  } catch (e) {
    return errorResponse(e);
  }
}
