import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { captureFlowSnapshot } from "@/lib/analytics/snapshot";

/**
 * Constant-time compare — a plain `===` on a shared secret leaks its prefix
 * through response timing.
 */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Daily board census for the Cumulative Flow Diagram, driven by whatever
 * scheduler the deployment has (the compose `snapshot` service, host cron, a
 * platform cron trigger — all of them just POST here).
 *
 * Fails closed: with no CRON_SECRET configured the endpoint is off rather than
 * open, since it walks every project in the database.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_NOT_CONFIGURED" }, { status: 503 });
  }

  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token || !secretMatches(token, secret)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const result = await captureFlowSnapshot();
  return NextResponse.json({ ok: true, ...result });
}
