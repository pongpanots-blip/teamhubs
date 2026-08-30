"use client";

import { useState } from "react";
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

export function SettingsPanels({
  role,
  invites,
  providers,
  hasPluginToken,
  projects,
  currentProjectId,
  currentProjectSlug,
  teamMembers,
}: {
  role: string;
  invites: { id: string; email: string; role: string; token: string; status: string }[];
  providers: { provider: string; updatedAt: string }[];
  hasPluginToken: boolean;
  projects: { slug: string; name: string }[];
  currentProjectId: string;
  currentProjectSlug: string;
  teamMembers: { id: string; name: string; email: string; projectRole: string | null }[];
}) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("backend");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSlug, setNewProjectSlug] = useState("");
  const [projectMsg, setProjectMsg] = useState<string | null>(null);
  const [memberRoles, setMemberRoles] = useState<Record<string, string>>(
    Object.fromEntries(teamMembers.map((m) => [m.id, m.projectRole ?? ""])),
  );
  const [memberMsg, setMemberMsg] = useState<string | null>(null);
  const [ghToken, setGhToken] = useState("");
  const [ghOwner, setGhOwner] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghWebhookSecret, setGhWebhookSecret] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaFileKey, setFigmaFileKey] = useState("");
  const [intMsg, setIntMsg] = useState<string | null>(null);
  const [pluginToken, setPluginToken] = useState<string | null>(null);
  const [pluginHasToken, setPluginHasToken] = useState(hasPluginToken);

  async function createInvite(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role: inviteRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setInviteMsg(data.error ?? "Failed");
      return;
    }
    setInviteMsg(`Invite created: ${data.acceptUrl}`);
    setEmail("");
  }

  async function saveGithub(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/integrations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "github",
        payload: { token: ghToken, owner: ghOwner, repo: ghRepo, webhookSecret: ghWebhookSecret },
      }),
    });
    const data = await res.json();
    setIntMsg(res.ok ? "GitHub credentials saved" : data.error);
  }

  async function saveFigma(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/integrations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "figma",
        payload: { token: figmaToken, fileKey: figmaFileKey },
      }),
    });
    const data = await res.json();
    setIntMsg(res.ok ? "Figma credentials saved" : data.error);
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newProjectName, slug: newProjectSlug }),
    });
    const data = await res.json();
    if (!res.ok) {
      setProjectMsg(data.error ?? "Failed");
      return;
    }
    setProjectMsg(`Created "${data.project.name}" — switch to it from the header dropdown.`);
    setNewProjectName("");
    setNewProjectSlug("");
  }

  async function assignProjectRole(userId: string, memberRole: string) {
    setMemberMsg(null);
    const res = await fetch(`/api/projects/${currentProjectId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role: memberRole }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMemberMsg(data.error ?? "Failed");
      return;
    }
    setMemberMsg("Saved");
  }

  async function generatePluginToken() {
    const res = await fetch("/api/integrations/plugin-token", { method: "POST" });
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
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-slate-600">Invites and integrations for your team.</p>
      </div>

      {role === "pm" ? (
        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Invite member</CardTitle>
            <CardDescription>Roles: pm · ui · backend · mobile · ai</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={createInvite} className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
                  Create invite
                </Button>
              </div>
            </form>
            {inviteMsg ? <p className="mt-3 text-sm text-slate-700">{inviteMsg}</p> : null}
            <div className="mt-4 space-y-1 text-sm">
              {invites.map((i) => (
                <div key={i.id} className="flex justify-between gap-2 text-slate-600">
                  <span>
                    {i.email} · {i.role} · {i.status}
                  </span>
                  <span className="truncate text-xs">/invite/{i.token}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {role === "pm" ? (
        <Card className="border-black/5 bg-white/80">
          <CardHeader>
            <CardTitle className="text-base">Projects</CardTitle>
            <CardDescription>
              Task/docs/RAG/integration credentials are scoped per project — one team can run
              several unrelated projects side by side. Current: {currentProjectSlug}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={createProject} className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input value={newProjectSlug} onChange={(e) => setNewProjectSlug(e.target.value)} required />
              </div>
              <div className="flex items-end">
                <Button type="submit" className="w-full">
                  Create project
                </Button>
              </div>
            </form>
            {projectMsg ? <p className="text-sm text-slate-700">{projectMsg}</p> : null}
            <ul className="text-sm text-slate-600">
              {projects.map((p) => (
                <li key={p.slug}>{p.name}</li>
              ))}
            </ul>

            <div className="space-y-2 border-t border-black/5 pt-4">
              <Label>Assign team members into &quot;{currentProjectSlug}&quot;</Label>
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
                      assignProjectRole(m.id, value);
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
          <form onSubmit={saveGithub} className="grid gap-3 sm:grid-cols-3">
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
          <form onSubmit={saveFigma} className="grid gap-3 sm:grid-cols-2">
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
            Lets designers mark a task &quot;Ready for Dev&quot; from inside Figma.
            Token status: {pluginHasToken ? "generated" : "not generated"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button variant="outline" size="sm" onClick={generatePluginToken}>
            {pluginHasToken ? "Regenerate token" : "Generate token"}
          </Button>
          {pluginToken ? (
            <div className="space-y-1">
              <p className="text-sm text-slate-700">
                Paste this into the TeamHub Figma plugin. It won&apos;t be shown again.
              </p>
              <Input readOnly value={pluginToken} onFocus={(e) => e.currentTarget.select()} />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
