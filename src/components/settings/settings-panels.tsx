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

export function SettingsPanels({
  role,
  invites,
  providers,
}: {
  role: string;
  invites: { id: string; email: string; role: string; token: string; status: string }[];
  providers: { provider: string; updatedAt: string }[];
}) {
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("dev");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [ghToken, setGhToken] = useState("");
  const [ghOwner, setGhOwner] = useState("");
  const [ghRepo, setGhRepo] = useState("");
  const [ghWebhookSecret, setGhWebhookSecret] = useState("");
  const [figmaToken, setFigmaToken] = useState("");
  const [figmaFileKey, setFigmaFileKey] = useState("");
  const [intMsg, setIntMsg] = useState<string | null>(null);

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
            <CardDescription>Roles: pm · ui · dev</CardDescription>
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
                    <SelectItem value="pm">PM</SelectItem>
                    <SelectItem value="ui">UI</SelectItem>
                    <SelectItem value="dev">Dev</SelectItem>
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
    </div>
  );
}
