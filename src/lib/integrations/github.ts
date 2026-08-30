import { Octokit } from "@octokit/rest";

export type GitHubContext = {
  issues: { number: number; title: string; state: string; url: string }[];
  pulls: { number: number; title: string; state: string; url: string }[];
};

export async function fetchGitHubContext(opts: {
  token?: string | null;
  owner?: string | null;
  repo?: string | null;
  query?: string;
}): Promise<GitHubContext | null> {
  if (!opts.token || !opts.owner || !opts.repo) return null;

  const octokit = new Octokit({ auth: opts.token });
  const q = opts.query?.trim();

  const [issuesRes, pullsRes] = await Promise.all([
    octokit.issues.listForRepo({
      owner: opts.owner,
      repo: opts.repo,
      state: "open",
      per_page: 10,
    }),
    octokit.pulls.list({
      owner: opts.owner,
      repo: opts.repo,
      state: "open",
      per_page: 10,
    }),
  ]);

  let issues = issuesRes.data
    .filter((i) => !i.pull_request)
    .map((i) => ({
      number: i.number,
      title: i.title,
      state: i.state ?? "open",
      url: i.html_url,
    }));

  let pulls = pullsRes.data.map((p) => ({
    number: p.number,
    title: p.title,
    state: p.state,
    url: p.html_url,
  }));

  if (q) {
    const lower = q.toLowerCase();
    issues = issues.filter((i) => i.title.toLowerCase().includes(lower));
    pulls = pulls.filter((p) => p.title.toLowerCase().includes(lower));
  }

  return { issues: issues.slice(0, 5), pulls: pulls.slice(0, 5) };
}
