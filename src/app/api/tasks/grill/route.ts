import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMembership } from "@/lib/auth-session";
import { grillTurn } from "@/lib/ai/grill";

const schema = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1) }))
    .min(1),
  forceFinish: z.boolean().optional(),
});

/**
 * One turn of the PM intake interview. Stateless — the client sends the full
 * conversation so far; we return either the next question or the final
 * structured result (requirement + business rules + per-component breakdown).
 */
export async function POST(req: Request) {
  try {
    await requireMembership();
    const body = schema.parse(await req.json());
    const turn = await grillTurn(body.messages, body.forceFinish);
    return NextResponse.json(turn);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 400 });
  }
}
