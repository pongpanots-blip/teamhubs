"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
    <div className="mx-auto max-w-[800px] space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">{teamName} settings</h1>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
          Team members and projects. Integrations and per-project roles live in each project&apos;s
          own settings.
        </p>
      </div>

      <SettingsCard
        title="Invite to team"
        description="Team-only invite — they join the team but no project yet. To bring someone straight into a project, invite them from that project's settings instead."
      >
        <form onSubmit={createInvite} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
          <Button type="submit">Create invite</Button>
        </form>
        {inviteMsg ? <p className="mt-2 text-sm">{inviteMsg}</p> : null}

        <div className="mt-2">
          {invites.map((i, idx) => (
            <div
              key={i.id}
              className={`flex items-center justify-between gap-2 py-2 text-[13px] ${idx > 0 ? "border-t border-border" : ""}`}
            >
              <span>
                {i.email} · {i.role}
                {i.projectName ? ` → ${i.projectName}` : ""}{" "}
                <span className="text-muted-foreground">· {i.status}</span>
              </span>
              <span className="font-mono text-[11px] text-muted-foreground">
                /invite/{i.token.slice(0, 6)}…
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 border-t border-border pt-3">
          {teamMembers.map((m, idx) => (
            <div
              key={m.id}
              className={`py-2 text-[13px] ${idx > 0 ? "border-t border-border" : ""}`}
            >
              {m.name} · {m.email} · {m.role}
            </div>
          ))}
        </div>
      </SettingsCard>

      <SettingsCard
        title="Projects"
        description="Tasks, docs/RAG and integration credentials are scoped per project, so one team can run several unrelated projects without their context bleeding together."
      >
        <form onSubmit={createProject} className="grid gap-3 sm:grid-cols-[1.4fr_1fr_auto] sm:items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Name</Label>
            <Input
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Slug</Label>
            <Input
              value={newProjectSlug}
              onChange={(e) => setNewProjectSlug(e.target.value)}
              required
            />
          </div>
          <Button type="submit">Create project</Button>
        </form>
        {projectMsg ? <p className="mt-2 text-sm">{projectMsg}</p> : null}
        <div className="mt-2">
          {projects.map((p, idx) => (
            <Link
              key={p.slug}
              href={projectSettings(p.slug)}
              className={`flex items-center justify-between gap-2 py-2 text-[13px] hover:underline ${idx > 0 ? "border-t border-border" : ""}`}
            >
              {p.name} <span className="text-muted-foreground">/{p.slug}</span>
            </Link>
          ))}
        </div>
      </SettingsCard>
    </div>
  );
}
