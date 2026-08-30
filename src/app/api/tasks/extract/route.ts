import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMembership } from "@/lib/auth-session";
import { extractDynamicRequirement } from "@/lib/ai/extract-rules";

const schema = z.object({
  text: z.string().min(1),
});

/**
 * PM pastes free-form intent → structured BusinessRules[] (+ title/requirement hints).
 * No fixed coupon schema — rules are whatever this text needs.
 */
export async function POST(req: Request) {
  try {
    await requireMembership();
    const body = schema.parse(await req.json());
    const extracted = await extractDynamicRequirement(body.text);
    return NextResponse.json(extracted);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "ERROR";
    return NextResponse.json({ error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 400 });
  }
}
