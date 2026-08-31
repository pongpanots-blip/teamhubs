"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { projectSettings } from "@/lib/routes";

/**
 * Settings that belong to the whole team: who is in it, and what projects it
 * runs. Anything scoped to one project lives at /app/[projectSlug]/settings.
 */
export function TeamSettingsPanels({
  teamName,
  invites,
  projects,
  teamMembers,
}: {
  teamName: string;
  invites: {
    id: string;
    email: string;
    role: string;
    token: string;
    status: string;
    projectName: string | null;
  }[];
  projects: { slug: string; name: string }[];
  teamMembers: { id: string; name: string; email: string; role: string }[];
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("backend");
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSlug, setNewProjectSlug] = useState("");
  const [projectMsg, setProjectMsg] = useState<string | null>(null);

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
    router.refresh();
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
    setNewProjectName("");
    setNewProjectSlug("");
    router.push(`/app/${data.project.slug}`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{teamName} settings</h1>
        <p className="text-sm text-slate-600">
          Team members and projects. Integrations and per-project roles live in each project&apos;s
          own settings.
        </p>
      </div>

      <Card className="border-black/5 bg-white/80">
        <CardHeader>
          <CardTitle className="text-base">Invite to team</CardTitle>
          <CardDescription>
            Team-only invite — they join the team but no project yet. To bring someone straight into
            a project, invite them from that project&apos;s settings instead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={createInvite} className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
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
                  {i.email} · {i.role}
                  {i.projectName ? ` → ${i.projectName}` : ""} · {i.status}
                </span>
                <span className="truncate text-xs">/invite/{i.token}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-1 border-t border-black/5 pt-4 text-sm text-slate-600">
            {teamMembers.map((m) => (
              <div key={m.id}>
                {m.name} · {m.email} · {m.role}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border-black/5 bg-white/80">
        <CardHeader>
          <CardTitle className="text-base">Projects</CardTitle>
          <CardDescription>
            Tasks, docs/RAG and integration credentials are scoped per project, so one team can run
            several unrelated projects without their context bleeding together.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={createProject} className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={newProjectSlug}
                onChange={(e) => setNewProjectSlug(e.target.value)}
                required
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" className="w-full">
                Create project
              </Button>
            </div>
          </form>
          {projectMsg ? <p className="text-sm text-slate-700">{projectMsg}</p> : null}
          <ul className="space-y-1 text-sm">
            {projects.map((p) => (
              <li key={p.slug}>
                <Link href={projectSettings(p.slug)} className="text-slate-700 hover:underline">
                  {p.name} <span className="text-slate-400">/{p.slug}</span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
