"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import {
  OVERVIEW,
  TEAM_SETTINGS,
  projectDocs,
  projectHome,
  projectSettings,
  projectTasks,
} from "@/lib/routes";

export function AppShell({
  children,
  teamName,
  role,
  projects,
  currentProjectSlug,
}: {
  children: React.ReactNode;
  teamName?: string;
  role?: string;
  projects?: { slug: string; name: string }[];
  /** Absent on team-level pages (overview, team settings) — they show no project nav. */
  currentProjectSlug?: string;
}) {
  const links = currentProjectSlug
    ? [
        { href: OVERVIEW, label: "All projects" },
        { href: projectHome(currentProjectSlug), label: "Overview" },
        { href: projectTasks(currentProjectSlug), label: "Tasks" },
        { href: projectDocs(currentProjectSlug), label: "Docs / RAG" },
        { href: projectSettings(currentProjectSlug), label: "Settings" },
      ]
    : [
        { href: OVERVIEW, label: "All projects" },
        ...(role === "pm" ? [{ href: TEAM_SETTINGS, label: "Team settings" }] : []),
      ];

  return (
    <div className="flex min-h-screen flex-col bg-[radial-gradient(ellipse_at_top,_#e8eef5_0%,_#f7f5f1_45%,_#f3efe8_100%)]">
      <header className="border-b border-black/5 bg-white/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href={OVERVIEW} className="font-semibold tracking-tight text-slate-900">
              IntrovertHubs
            </Link>
            <nav className="hidden items-center gap-1 sm:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-900/5 hover:text-slate-900"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {projects && currentProjectSlug ? (
              <ProjectSwitcher projects={projects} currentSlug={currentProjectSlug} />
            ) : null}
            <NotificationBell />
            {teamName ? (
              <span className="hidden text-xs text-slate-500 sm:inline">
                {teamName}
                {role ? ` · ${role.toUpperCase()}` : ""}
              </span>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      window.location.href = "/login";
                    },
                  },
                });
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8">{children}</main>
    </div>
  );
}
