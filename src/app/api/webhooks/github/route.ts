import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { cascadeFromTask, reevaluateTask } from "@/lib/engine/cascade";

type GithubCredentialPayload = {
  owner?: string;
  repo?: string;
  webhookSecret?: string;
};

function verifySignature(secret: string, rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const provided = signatureHeader.slice("sha256=".length);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(provided, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * GitHub calls this on repo events. We only act on a PR merge: it is the
 * signal that the API work a task represents has actually landed, so it
 * flips apiReady + status the same way a human closing the task would —
 * which is what lets cascadeFromTask unblock and notify dependents.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();
  const event = req.headers.get("x-github-event");
  if (event !== "pull_request") {
    return NextResponse.json({ ok: true, skipped: "not a pull_request event" });
  }

  let payload: {
    action?: string;
    repository?: { full_name?: string };
    pull_request?: { html_url?: string; merged?: boolean };
  };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const fullName = payload.repository?.full_name;
  if (!fullName) return NextResponse.json({ error: "MISSING_REPOSITORY" }, { status: 400 });
  const [owner, repo] = fullName.split("/");

  const candidates = await prisma.integrationCredential.findMany({
    where: { provider: "github" },
  });
  const match = candidates
    .map((row) => ({ row, creds: decryptJson<GithubCredentialPayload>(row.payload) }))
    .find(
      (c) =>
        c.creds.owner?.toLowerCase() === owner?.toLowerCase() &&
        c.creds.repo?.toLowerCase() === repo?.toLowerCase(),
    );
  if (!match) return NextResponse.json({ error: "UNKNOWN_REPOSITORY" }, { status: 404 });

  if (!match.creds.webhookSecret || !verifySignature(match.creds.webhookSecret, rawBody, req.headers.get("x-hub-signature-256"))) {
    return NextResponse.json({ error: "INVALID_SIGNATURE" }, { status: 401 });
  }

  if (payload.action !== "closed" || !payload.pull_request?.merged) {
    return NextResponse.json({ ok: true, skipped: "not a merge" });
  }

  const prUrl = payload.pull_request.html_url;
  const task = await prisma.task.findFirst({
    where: { projectId: match.row.projectId, githubPrUrl: prUrl },
  });
  if (!task) return NextResponse.json({ ok: true, skipped: "no task linked to this PR" });

  await prisma.task.update({
    where: { id: task.id },
    data: { apiReady: true, status: task.status === "done" ? undefined : "done" },
  });
  await reevaluateTask(task.id);
  const cascade = await cascadeFromTask(task.id);

  return NextResponse.json({
    ok: true,
    taskId: task.id,
    cascade: cascade.filter((c) => c.changed).map((c) => ({ taskId: c.task.id, to: c.status })),
  });
}
