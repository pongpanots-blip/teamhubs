import { Octokit } from "@octokit/rest";
import { prisma } from "@/lib/db";
import { decryptJson } from "@/lib/crypto";
import { businessDaysBetween } from "@/lib/business-time";
import { computeTaskMetrics } from "@/lib/tasks/metrics";
import { cappedWorkingHours, sessionHoursFromCommits } from "@/lib/tasks/actual-hours";
import { STATUS_CATEGORY, type TaskStatusValue } from "@/lib/task-constants";

/** Where a card's actualHours came from. Mirrors Task.actualHoursSource. */
export type ActualHoursSource = "commits" | "status";

export type RecomputeResult = { hours: number; source: ActualHoursSource };

type GithubCredentialPayload = { owner?: string; repo?: string; token?: string };

/** https://github.com/<owner>/<repo>/pull/<number> — anything else is not a PR. */
const PR_URL_RE = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/i;

function parsePrUrl(url: string): { owner: string; repo: string; number: number } | null {
  const m = url.match(PR_URL_RE);
  if (!m) return null;
  return { owner: m[1], repo: m[2], number: Number(m[3]) };
}

/**
 * Commit timestamps for a PR, or null if we cannot get them.
 *
 * Every failure path returns null rather than throwing: this runs off the back
 * of a merge webhook, and a rate limit or a revoked token must not turn a
 * successful merge into a 500. The caller falls back to status time.
 */
async function fetchPrCommitTimes(opts: {
  token: string;
  owner: string;
  repo: string;
  number: number;
}): Promise<Date[] | null> {
  try {
    const octokit = new Octokit({ auth: opts.token });
    const commits = await octokit.paginate(octokit.pulls.listCommits, {
      owner: opts.owner,
      repo: opts.repo,
      pull_number: opts.number,
      per_page: 100,
    });
    const times = commits
      .map((c) => c.commit.author?.date ?? c.commit.committer?.date)
      .filter((d): d is string => Boolean(d))
      .map((d) => new Date(d))
      .filter((d) => !Number.isNaN(d.getTime()));
    return times.length > 0 ? times : null;
  } catch {
    return null;
  }
}

/**
 * Work out how long a finished card actually took, and record it.
 *
 * Commits are preferred because they are evidence of someone working; status
 * time is a fallback that only knows when the card moved. Returns null when the
 * card is not done — an unfinished card has no total to report.
 */
export async function recomputeActualHours(taskId: string): Promise<RecomputeResult | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      projectId: true,
      githubPrUrl: true,
      statusHistory: {
        orderBy: { changedAt: "asc" },
        select: { fromStatus: true, toStatus: true, changedAt: true },
      },
    },
  });
  if (!task) return null;
  if (STATUS_CATEGORY[task.status as TaskStatusValue] !== "done") return null;

  const result =
    (await hoursFromCommits(task.projectId, task.githubPrUrl)) ??
    hoursFromStatusTime(task.createdAt, task.statusHistory);
  if (!result) return null;

  await prisma.task.update({
    where: { id: task.id },
    data: {
      actualHours: result.hours,
      actualHoursSource: result.source,
      actualHoursComputedAt: new Date(),
    },
  });
  return result;
}

async function hoursFromCommits(
  projectId: string,
  prUrl: string | null,
): Promise<RecomputeResult | null> {
  if (!prUrl) return null;
  const pr = parsePrUrl(prUrl);
  if (!pr) return null;

  const credential = await prisma.integrationCredential.findUnique({
    where: { projectId_provider: { projectId, provider: "github" } },
  });
  if (!credential) return null;

  let creds: GithubCredentialPayload;
  try {
    creds = decryptJson<GithubCredentialPayload>(credential.payload);
  } catch {
    return null;
  }
  if (!creds.token) return null;

  const times = await fetchPrCommitTimes({ ...pr, token: creds.token });
  if (!times) return null;

  return { hours: sessionHoursFromCommits(times), source: "commits" };
}

function hoursFromStatusTime(
  createdAt: Date,
  history: { fromStatus: string | null; toStatus: string; changedAt: Date }[],
): RecomputeResult | null {
  if (history.length === 0) return null;

  const metrics = computeTaskMetrics({
    createdAt,
    history: history.map((h) => ({
      fromStatus: h.fromStatus as TaskStatusValue | null,
      toStatus: h.toStatus as TaskStatusValue,
      changedAt: h.changedAt,
    })),
  });

  const firstActiveAt = history.find(
    (h) => STATUS_CATEGORY[h.toStatus as TaskStatusValue] === "active",
  )?.changedAt;
  // A card that went straight to done without ever being `working` has no span
  // to cap against, and no working time to report.
  if (!firstActiveAt) return null;

  const doneAt = history[history.length - 1].changedAt;
  const days = businessDaysBetween(firstActiveAt, doneAt);

  return {
    hours: cappedWorkingHours(metrics.timeInStatusMs.working, days),
    source: "status",
  };
}

/**
 * Recompute only when a transition actually finished the card, so callers can
 * fire this after any status change without checking first.
 */
export async function maybeRecomputeActualHours(
  taskId: string,
  toStatus: TaskStatusValue,
): Promise<RecomputeResult | null> {
  if (STATUS_CATEGORY[toStatus] !== "done") return null;
  return recomputeActualHours(taskId);
}
