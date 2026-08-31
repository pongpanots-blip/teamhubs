"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TEAM_ROLES, TEAM_ROLE_LABEL } from "@/lib/task-constants";
import { TEAM_SETTINGS } from "@/lib/routes";

export type TeamMemberOption = {
  id: string;
  name: string;
  email: string;
  projectRole: string | null;
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
}: {
  isPm: boolean;
  projectId: string;
  projectSlug: string;
  projectName: string;
  providers: { provider: string; updatedAt: string }[];
  hasPluginToken: boolean;
  teamMembers: TeamMemberOption[];
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

  const scoped = (path: string) => `${path}?project=${encodeURIComponent(projectSlug)}`;

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
    setInviteMsg(`Invite created: ${data.acceptUrl}`);
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{projectName} settings</h1>
        <p className="text-sm text-slate-600">
          Members and integrations for this project only.{" "}
          <Link href={TEAM_SETTINGS} className="underline">
            Team settings
          </Link>{" "}
          cover invites and creating projects.
        </p>
      </div>

      {isPm ? (
        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Members</CardTitle>
            <CardDescription>
              People in this project. Anyone already on the team is added instantly; anyone else
              gets an invite that puts them in the team and this project at once.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              {teamMembers.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 text-sm">
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
                    <SelectTrigger className="w-36">
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
              {memberMsg ? <p className="text-sm text-slate-700">{memberMsg}</p> : null}
            </div>

            <form
              onSubmit={inviteToProject}
              className="grid gap-3 border-t border-black/5 pt-4 sm:grid-cols-3"
            >
              <div className="space-y-2">
                <Label>Invite by email</Label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
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
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Invite to project
                </Button>
              </div>
            </form>
            {inviteMsg ? <p className="text-sm text-slate-700">{inviteMsg}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-black/5 bg-white/80">
        <CardHeader>
          <CardTitle className="text-base">GitHub</CardTitle>
          <CardDescription>
            Connected: {providers.some((p) => p.provider === "github") ? "yes" : "no"}. Add a webhook
            to your repo pointing at <code>/api/webhooks/github</code> (content type
            application/json, events: Pull requests) to auto-resolve dependencies on merge.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
            <div className="space-y-2">
              <Label>Token</Label>
              <Input type="password" value={ghToken} onChange={(e) => setGhToken(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Owner</Label>
              <Input value={ghOwner} onChange={(e) => setGhOwner(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Repo</Label>
              <Input value={ghRepo} onChange={(e) => setGhRepo(e.target.value)} />
            </div>
            <div className="space-y-2 sm:col-span-3">
              <Label>Webhook secret</Label>
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
        </CardContent>
      </Card>

      <Card className="border-black/5 bg-white/80">
        <CardHeader>
          <CardTitle className="text-base">Figma</CardTitle>
          <CardDescription>
            Connected: {providers.some((p) => p.provider === "figma") ? "yes" : "no"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void saveCredential("figma", { token: figmaToken, fileKey: figmaFileKey });
            }}
            className="grid gap-3 sm:grid-cols-2"
          >
            <div className="space-y-2">
              <Label>Token</Label>
              <Input
                type="password"
                value={figmaToken}
                onChange={(e) => setFigmaToken(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>File key</Label>
              <Input value={figmaFileKey} onChange={(e) => setFigmaFileKey(e.target.value)} />
            </div>
            <Button type="submit" className="sm:col-span-2">
              Save Figma
            </Button>
          </form>
          {intMsg ? <p className="mt-3 text-sm text-slate-700">{intMsg}</p> : null}
        </CardContent>
      </Card>

      <Card className="border-black/5 bg-white/80">
        <CardHeader>
          <CardTitle className="text-base">Figma Plugin</CardTitle>
          <CardDescription>
            Lets designers mark a task &quot;Ready for Dev&quot; from inside Figma. Scoped to this
            project ({projectSlug}). Token status: {pluginHasToken ? "generated" : "not generated"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" onClick={generatePluginToken}>
            {pluginHasToken ? "Regenerate token" : "Generate token"}
          </Button>
          {pluginToken ? (
            <div className="space-y-1">
              <p className="text-sm text-slate-700">
                Paste this into the IntrovertHubs Figma plugin. It won&apos;t be shown again.
              </p>
              <Input readOnly value={pluginToken} onFocus={(e) => e.currentTarget.select()} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
