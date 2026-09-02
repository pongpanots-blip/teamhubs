"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsCard } from "@/components/settings/settings-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { inviteResultMessage } from "@/lib/notify/invite-result";
import { TEAM_ROLES, TEAM_ROLE_LABEL } from "@/lib/task-constants";
import { TEAM_SETTINGS } from "@/lib/routes";

export type TeamMemberOption = {
  id: string;
  name: string;
  email: string;
  projectRole: string | null;
};

export type ProjectRepositoryOption = {
  id: string;
  owner: string;
  name: string;
  defaultBranch: string;
  pathPrefix: string | null;
  isPrimary: boolean;
};

export type ProjectFigmaFileOption = {
  id: string;
  fileKey: string;
  name: string;
  isPrimary: boolean;
};

/**
 * Settings that belong to one project: its integration credentials, its Figma
 * plugin token, and who is in it. Team-wide settings live at /app/team/settings.
 */
export function ProjectSettingsPanels({
  isPm,
  projectId,
  projectSlug,
  projectName,
  providers,
  hasPluginToken,
  teamMembers,
  repositories,
  figmaFiles,
}: {
  isPm: boolean;
  projectId: string;
  projectSlug: string;
  projectName: string;
  providers: { provider: string; updatedAt: string }[];
  hasPluginToken: boolean;
  teamMembers: TeamMemberOption[];
  repositories: ProjectRepositoryOption[];
  figmaFiles: ProjectFigmaFileOption[];
}) {
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>(
    Object.fromEntries(teamMembers.map((m) => [m.id, m.projectRole ?? ""])),
  );
  const [memberMsg, setMemberMsg] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("backend");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [ghToken, setGhToken] = useState("");
  const [ghOwner, setGhOwner] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghWebhookSecret, setGhWebhookSecret] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaFileKey, setFigmaFileKey] = useState("");
  const [intMsg, setIntMsg] = useState<string | null>(null);
  const [pluginToken, setPluginToken] = useState<string | null>(null);
  const [pluginHasToken, setPluginHasToken] = useState(hasPluginToken);

  const [repos, setRepos] = useState(repositories);
  const [repoOwner, setRepoOwner] = useState("");
  const [repoName, setRepoName] = useState("");
  const [repoBranch, setRepoBranch] = useState("main");
  const [repoPathPrefix, setRepoPathPrefix] = useState("");
  const [repoMsg, setRepoMsg] = useState<string | null>(null);

  const [figFiles, setFigFiles] = useState(figmaFiles);
  const [figUrl, setFigUrl] = useState("");
  const [figName, setFigName] = useState("");
  const [figMsg, setFigMsg] = useState<string | null>(null);

  const scoped = (path: string) => `${path}?project=${encodeURIComponent(projectSlug)}`;

  async function addRepo(e: React.FormEvent) {
    e.preventDefault();
    setRepoMsg(null);
    const res = await fetch(scoped("/api/projects/repos"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        owner: repoOwner,
        name: repoName,
        defaultBranch: repoBranch || "main",
        pathPrefix: repoPathPrefix || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setRepoMsg(data.error ?? "Failed");
      return;
    }
    setRepos((prev) => [...prev, data.repository]);
    setRepoOwner("");
    setRepoName("");
    setRepoPathPrefix("");
  }

  async function removeRepo(id: string) {
    setRepoMsg(null);
    const res = await fetch(`/api/projects/repos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setRepoMsg(data.error ?? "Failed");
      return;
    }
    setRepos((prev) => prev.filter((r) => r.id !== id));
  }

  async function addFigmaFile(e: React.FormEvent) {
    e.preventDefault();
    setFigMsg(null);
    const res = await fetch(scoped("/api/projects/figma-files"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileUrl: figUrl, name: figName }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFigMsg(
        data.error === "INVALID_FIGMA_URL" ? "That doesn't look like a Figma file link" : (data.error ?? "Failed"),
      );
      return;
    }
    setFigFiles((prev) => [...prev, data.figmaFile]);
    setFigUrl("");
    setFigName("");
  }

  async function removeFigmaFile(id: string) {
    setFigMsg(null);
    const res = await fetch(`/api/projects/figma-files/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setFigMsg(data.error ?? "Failed");
      return;
    }
    setFigFiles((prev) => prev.filter((f) => f.id !== id));
  }

  async function saveCredential(provider: "github" | "figma", payload: Record<string, string>) {
    const res = await fetch(scoped("/api/integrations"), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, payload }),
    });
    const data = await res.json();
    setIntMsg(res.ok ? `${provider === "github" ? "GitHub" : "Figma"} credentials saved` : data.error);
  }

  /** Someone already on the team just gets added — they authenticated once already. */
  async function assignProjectRole(userId: string, memberRole: string) {
    setMemberMsg(null);
    const res = await fetch(`/api/projects/${projectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: memberRole }),
    });
    const data = await res.json();
    setMemberMsg(res.ok ? "Saved" : (data.error ?? "Failed"));
  }

  /** Someone outside the team needs an invite that lands them in team AND project. */
  async function inviteToProject(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: inviteEmail,
        role: inviteRole,
        projectSlug,
        projectRole: inviteRole,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteMsg(data.error ?? "Failed");
      return;
    }
    setInviteMsg(inviteResultMessage(data.acceptUrl, data.delivery));
    setInviteEmail("");
  }

  async function generatePluginToken() {
    const res = await fetch(scoped("/api/integrations/plugin-token"), { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setIntMsg(data.error);
      return;
    }
    setPluginToken(data.token);
    setPluginHasToken(true);
  }

  return (
    <div className="mx-auto max-w-[800px] space-y-5">
      <div>
        <h1 className="text-title font-semibold tracking-tight">{projectName} settings</h1>
        <p className="mt-1.5 text-body leading-relaxed text-muted-foreground">
          Members and integrations for this project only.{" "}
          <Link href={TEAM_SETTINGS} className="underline">
            Team settings
          </Link>{" "}
          cover invites and creating projects.
        </p>
      </div>

      {isPm ? (
        <SettingsCard
          title="Members"
          description="People in this project. Anyone already on the team is added instantly; anyone else gets an invite that puts them in the team and this project at once."
        >
          <div>
            {teamMembers.map((m, i) => (
              <div
                key={m.id}
                className={`flex items-center justify-between gap-2 py-2 text-body ${i > 0 ? "border-t border-border" : ""}`}
              >
                <span className="min-w-0 flex-1 truncate">
                  {m.name} · {m.email}
                </span>
                <Select
                  value={memberRoles[m.id] || undefined}
                  onValueChange={(value) => {
                    if (!value) return;
                    setMemberRoles((prev) => ({ ...prev, [m.id]: value }));
                    void assignProjectRole(m.id, value);
                  }}
                >
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue placeholder="Not in project" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEAM_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {TEAM_ROLE_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
            {memberMsg ? <p className="mt-2 text-sm">{memberMsg}</p> : null}
          </div>

          <form
            onSubmit={inviteToProject}
            className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-[1.2fr_1fr_auto] sm:items-end"
          >
            <div className="space-y-1.5">
              <Label className="text-xs">Invite by email</Label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(value) => {
                  if (value) setInviteRole(value);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEAM_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {TEAM_ROLE_LABEL[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit">Invite to project</Button>
          </form>
          {inviteMsg ? <p className="mt-2 text-sm">{inviteMsg}</p> : null}
        </SettingsCard>
      ) : null}

      <SettingsCard
        title="GitHub"
        description={
          <>
            Connected: {providers.some((p) => p.provider === "github") ? "yes" : "no"}. Add a
            webhook to your repo pointing at{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-meta">
              /api/webhooks/github
            </code>{" "}
            (content type application/json, events: Pull requests) to auto-resolve dependencies on
            merge.
          </>
        }
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveCredential("github", {
              token: ghToken,
              owner: ghOwner,
              repo: ghRepo,
              webhookSecret: ghWebhookSecret,
            });
          }}
          className="grid gap-3 sm:grid-cols-3"
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Token</Label>
            <Input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Owner</Label>
            <Input value={ghOwner} onChange={(e) => setGhOwner(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Repo</Label>
            <Input value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label className="text-xs">Webhook secret</Label>
            <Input
              type="password"
              value={ghWebhookSecret}
              onChange={(e) => setGhWebhookSecret(e.target.value)}
            />
          </div>
          <Button type="submit" className="sm:col-span-3">
            Save GitHub
          </Button>
        </form>
      </SettingsCard>

      <SettingsCard
        title="Figma"
        description={`Connected: ${providers.some((p) => p.provider === "figma") ? "yes" : "no"}`}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void saveCredential("figma", { token: figmaToken, fileKey: figmaFileKey });
          }}
          className="grid gap-3 sm:grid-cols-2"
        >
          <div className="space-y-1.5">
            <Label className="text-xs">Token</Label>
            <Input
              type="password"
              value={figmaToken}
              onChange={(e) => setFigmaToken(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">File key</Label>
            <Input value={figmaFileKey} onChange={(e) => setFigmaFileKey(e.target.value)} />
          </div>
          <Button type="submit" className="sm:col-span-2">
            Save Figma
          </Button>
        </form>
        {intMsg ? <p className="mt-3 text-sm">{intMsg}</p> : null}
      </SettingsCard>

      <SettingsCard
        title="Repositories"
        description="Which repo(s) this project's code lives in — so dev/AI know where to check commits and push, even before a task has its own PR link."
      >
        <div>
          {repos.map((r, i) => (
            <div
              key={r.id}
              className={`flex items-center justify-between gap-2 py-2 text-body ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate font-mono text-xs">
                {r.owner}/{r.name}
                {r.pathPrefix ? ` · ${r.pathPrefix}` : ""} · {r.defaultBranch}
                {r.isPrimary ? " · primary" : ""}
              </span>
              {isPm ? (
                <Button variant="outline" size="sm" onClick={() => removeRepo(r.id)}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {repos.length === 0 ? (
            <p className="text-sm text-muted-foreground">No repos registered yet.</p>
          ) : null}
        </div>

        {isPm ? (
          <form
            onSubmit={addRepo}
            className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4 sm:items-end"
          >
            <div className="space-y-1.5">
              <Label className="text-xs">Owner</Label>
              <Input value={repoOwner} onChange={(e) => setRepoOwner(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Repo</Label>
              <Input value={repoName} onChange={(e) => setRepoName(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Branch</Label>
              <Input value={repoBranch} onChange={(e) => setRepoBranch(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Path prefix (monorepo)</Label>
              <Input value={repoPathPrefix} onChange={(e) => setRepoPathPrefix(e.target.value)} />
            </div>
            <Button type="submit" className="sm:col-span-4">
              Add repo
            </Button>
          </form>
        ) : null}
        {repoMsg ? <p className="mt-2 text-sm">{repoMsg}</p> : null}
      </SettingsCard>

      <SettingsCard
        title="Figma files"
        description="Which Figma file(s) this project's design lives in — so a task without its own link yet still points somewhere real."
      >
        <div>
          {figFiles.map((f, i) => (
            <div
              key={f.id}
              className={`flex items-center justify-between gap-2 py-2 text-body ${i > 0 ? "border-t border-border" : ""}`}
            >
              <span className="min-w-0 flex-1 truncate">
                {f.name}
                {f.isPrimary ? " · primary" : ""}
                <span className="ml-1.5 font-mono text-xs text-muted-foreground">{f.fileKey}</span>
              </span>
              {isPm ? (
                <Button variant="outline" size="sm" onClick={() => removeFigmaFile(f.id)}>
                  Remove
                </Button>
              ) : null}
            </div>
          ))}
          {figFiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Figma files registered yet.</p>
          ) : null}
        </div>

        {isPm ? (
          <form
            onSubmit={addFigmaFile}
            className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 sm:items-end"
          >
            <div className="space-y-1.5">
              <Label className="text-xs">Figma file link</Label>
              <Input
                value={figUrl}
                onChange={(e) => setFigUrl(e.target.value)}
                placeholder="https://www.figma.com/design/..."
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={figName} onChange={(e) => setFigName(e.target.value)} required />
            </div>
            <Button type="submit" className="sm:col-span-2">
              Add Figma file
            </Button>
          </form>
        ) : null}
        {figMsg ? <p className="mt-2 text-sm">{figMsg}</p> : null}
      </SettingsCard>

      <SettingsCard
        title="Figma Plugin"
        description={`Lets designers mark a task "Ready for Dev" from inside Figma. Scoped to this project (${projectSlug}). Token status: ${pluginHasToken ? "generated" : "not generated"}`}
      >
        <div className="space-y-3">
          <Button variant="outline" size="sm" onClick={generatePluginToken}>
            {pluginHasToken ? "Regenerate token" : "Generate token"}
          </Button>
          {pluginToken ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Paste this into the IntrovertHubs Figma plugin. It won&apos;t be shown again.
              </p>
              <Input
                readOnly
                aria-label="Figma plugin token"
                value={pluginToken}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
            </div>
          ) : null}
        </div>
      </SettingsCard>
    </div>
  );
}
