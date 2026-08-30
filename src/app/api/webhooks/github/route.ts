import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { Octokit } from "@octokit/rest";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { cascadeFromTask, reevaluateTask } from "@/lib/engine/cascade";
import { forwardCompletionDoc } from "@/lib/tasks/completion-doc";

/** Convention devs are told to put in the PR title, e.g. "[TASK-cmtg...] Add coupon API". */
const TASK_TAG_RE = /\[TASK-([a-z0-9]+)\]/i;

/** Path a dev commits their completion doc to, as told in the handoff doc. */
function completionDocPath(taskId: string) {
  return `docs/handoff/${taskId}.md`;
}

type GithubCredentialPayload = {
  owner?: string;
  repo?: string;
  webhookSecret?: string;
  token?: string;
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
    pull_request?: {
      html_url?: string;
      merged?: boolean;
      title?: string;
      body?: string | null;
      merge_commit_sha?: string | null;
    };
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
  const tagMatch = `${payload.pull_request.title ?? ""} ${payload.pull_request.body ?? ""}`.match(
    TASK_TAG_RE,
  );
  const task = tagMatch
    ? await prisma.task.findFirst({ where: { id: tagMatch[1], teamId: match.row.teamId } })
    : await prisma.task.findFirst({ where: { teamId: match.row.teamId, githubPrUrl: prUrl } });
  if (!task) return NextResponse.json({ ok: true, skipped: "no task linked to this PR" });

  await prisma.task.update({
    where: { id: task.id },
    data: {
      apiReady: true,
      status: task.status === "done" ? undefined : "done",
      githubPrUrl: task.githubPrUrl ?? prUrl,
    },
  });
  await reevaluateTask(task.id);
  const cascade = await cascadeFromTask(task.id);

  let completionDocAttached = false;
  if (task.component && match.creds.token && payload.pull_request.merge_commit_sha) {
    const doc = await fetchCompletionDocFromRepo({
      token: match.creds.token,
      owner,
      repo,
      ref: payload.pull_request.merge_commit_sha,
      path: completionDocPath(task.id),
    });
    if (doc) {
      await forwardCompletionDoc({
        sourceTaskId: task.id,
        sourceComponent: task.component,
        title: `${task.title} — Completion notes`,
        content: doc,
      });
      completionDocAttached = true;
    }
  }

  return NextResponse.json({
    ok: true,
    taskId: task.id,
    completionDocAttached,
    cascade: cascade.filter((c) => c.changed).map((c) => ({ taskId: c.task.id, to: c.status })),
  });
}

async function fetchCompletionDocFromRepo(opts: {
  token: string;
  owner: string;
  repo: string;
  ref: string;
  path: string;
}): Promise<string | null> {
  try {
    const octokit = new Octokit({ auth: opts.token });
    const res = await octokit.repos.getContent({
      owner: opts.owner,
      repo: opts.repo,
      path: opts.path,
      ref: opts.ref,
    });
    const data = res.data;
    if (Array.isArray(data) || data.type !== "file" || !data.content) return null;
    return Buffer.from(data.content, "base64").toString("utf-8");
  } catch {
    return null;
  }
}
