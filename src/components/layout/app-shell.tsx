"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  OVERVIEW,
  TEAM_SETTINGS,
  projectDocs,
  projectHome,
  projectSettings,
  projectSprints,
  projectTasks,
} from "@/lib/routes";

type NavLink = { href: string; label: string };

/**
 * Longest matching href wins, so /app/acme/tasks/42 marks Tasks rather than the
 * /app overview that also prefixes it. Exact match alone would leave every
 * detail page with no active link at all.
 */
function activeHref(pathname: string, links: NavLink[]): string | null {
  let best: string | null = null;
  for (const l of links) {
    const hit = pathname === l.href || pathname.startsWith(`${l.href}/`);
    if (hit && (best === null || l.href.length > best.length)) best = l.href;
  }
  return best;
}

/** The sidebar's contents — shared between the fixed desktop rail and the mobile drawer. */
function SidebarNav({
  links,
  current,
  currentProjectName,
  teamName,
  role,
  userName,
  onNavigate,
}: {
  links: NavLink[];
  current: string | null;
  currentProjectName?: string;
  teamName?: string;
  role?: string;
  userName?: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col px-5 py-6">
      <div className="mb-6">
        <div className="text-[10px] font-semibold tracking-[0.16em] text-sidebar-primary uppercase">
          Product Ops
        </div>
        <Link
          href={OVERVIEW}
          onClick={onNavigate}
          className="block text-[22px] leading-tight font-semibold tracking-tight text-sidebar-foreground font-[family-name:var(--font-fraunces)]"
        >
          Introvert<span className="font-medium text-sidebar-primary italic">Hubs</span>
        </Link>
        {teamName ? (
          <div className="mt-2.5 border-t border-sidebar-border pt-2.5 text-[10.5px] text-sidebar-foreground/60">
            {teamName}
          </div>
        ) : null}
      </div>

      <Link
        href={OVERVIEW}
        onClick={onNavigate}
        className="mb-5 flex items-center gap-2 rounded-lg bg-sidebar-accent px-2.5 py-2 text-sidebar-accent-foreground hover:ring-1 hover:ring-sidebar-primary/40"
      >
        <span className="size-1.5 shrink-0 rounded-full bg-sidebar-primary" />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {currentProjectName ?? "All projects"}
        </span>
        <span className="shrink-0 text-[10px] text-sidebar-foreground/50">⇄</span>
      </Link>

      {links.length > 0 ? (
        <nav className="flex flex-col">
          {links.map((l, i) => {
            const active = current === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-baseline gap-2.5 border-t border-sidebar-border px-1 py-2.5 first:border-t-0",
                  active
                    ? "text-sidebar-foreground"
                    : "text-sidebar-foreground/55 hover:text-sidebar-foreground",
                )}
              >
                {active ? (
                  <span className="absolute -left-5 top-2 bottom-2 w-[3px] rounded-r-full bg-sidebar-primary" />
                ) : null}
                <span
                  className="w-4 shrink-0 text-[11px] font-[family-name:var(--font-fraunces)]"
                  style={{ color: active ? "var(--sidebar-primary)" : undefined }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[13.5px] font-medium">{l.label}</span>
              </Link>
            );
          })}
        </nav>
      ) : (
        <p className="text-[11px] leading-relaxed text-sidebar-foreground/50">
          Pick a project above to see its pages.
        </p>
      )}

      <div className="flex-1" />

      <div className="border-t border-sidebar-border pt-3.5">
        <div className="mb-2 text-[9.5px] font-semibold tracking-[0.1em] text-sidebar-foreground/40 uppercase">
          Signed in as
        </div>
        <div className="flex items-center gap-2.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent text-xs font-semibold text-sidebar-primary font-[family-name:var(--font-fraunces)]">
            {(userName ?? teamName ?? "?").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12.5px] font-semibold text-sidebar-foreground">
              {userName ?? "—"}
            </div>
            {role ? (
              <div className="text-[10.5px] text-sidebar-foreground/55">{role.toUpperCase()}</div>
            ) : null}
          </div>
        </div>
        <div className="mt-2.5 flex gap-3 text-[10.5px]">
          {role === "pm" ? (
            <Link
              href={TEAM_SETTINGS}
              onClick={onNavigate}
              className="text-sidebar-foreground/55 underline underline-offset-2 hover:text-sidebar-foreground"
            >
              Team settings
            </Link>
          ) : null}
          <button
            type="button"
            className="text-sidebar-foreground/55 underline underline-offset-2 hover:text-sidebar-foreground"
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
          </button>
        </div>
      </div>
    </div>
  );
}

export function AppShell({
  children,
  teamName,
  role,
  projects,
  currentProjectSlug,
  userName,
}: {
  children: React.ReactNode;
  teamName?: string;
  role?: string;
  projects?: { slug: string; name: string }[];
  /** Absent on team-level pages (overview, team settings) — they show no project nav. */
  currentProjectSlug?: string;
  userName?: string;
}) {
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const links: NavLink[] = currentProjectSlug
    ? [
        { href: projectHome(currentProjectSlug), label: "Overview" },
        { href: projectTasks(currentProjectSlug), label: "Tasks" },
        { href: projectSprints(currentProjectSlug), label: "Sprints" },
        { href: projectDocs(currentProjectSlug), label: "Docs / RAG" },
        { href: projectSettings(currentProjectSlug), label: "Settings" },
      ]
    : [];

  const current = activeHref(pathname, links);
  const currentProjectName = projects?.find((p) => p.slug === currentProjectSlug)?.name;

  const navProps = { links, current, currentProjectName, teamName, role, userName };

  return (
    <div className="flex h-dvh overflow-hidden bg-(image:--canvas-app)">
      <aside className="hidden w-[248px] shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar sm:block">
        <SidebarNav {...navProps} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-border bg-card/70 px-4 py-3 backdrop-blur sm:justify-end sm:px-6">
          <div className="flex items-center gap-2 sm:hidden">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger
                render={
                  <Button variant="ghost" size="icon-sm" aria-label="Open navigation" />
                }
              >
                <MenuIcon />
              </SheetTrigger>
              <SheetContent side="left" className="w-[260px] bg-sidebar p-0">
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <SidebarNav {...navProps} onNavigate={() => setNavOpen(false)} />
              </SheetContent>
            </Sheet>
            <span className="font-semibold text-foreground">IntrovertHubs</span>
          </div>
          <NotificationBell />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
          <div className="mx-auto w-full max-w-[1440px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
