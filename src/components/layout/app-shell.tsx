"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MenuIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import {
  OVERVIEW,
  TEAM_SETTINGS,
  projectAnalytics,
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
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const links: NavLink[] = currentProjectSlug
    ? [
        { href: OVERVIEW, label: "All projects" },
        { href: projectHome(currentProjectSlug), label: "Overview" },
        { href: projectTasks(currentProjectSlug), label: "Tasks" },
        { href: projectSprints(currentProjectSlug), label: "Sprints" },
        { href: projectAnalytics(currentProjectSlug), label: "Analytics" },
        { href: projectDocs(currentProjectSlug), label: "Docs / RAG" },
        { href: projectSettings(currentProjectSlug), label: "Settings" },
      ]
    : [
        { href: OVERVIEW, label: "All projects" },
        ...(role === "pm" ? [{ href: TEAM_SETTINGS, label: "Team settings" }] : []),
      ];

  const current = activeHref(pathname, links);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-(image:--canvas-app)">
      <header className="border-b border-border bg-card/70 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-2 sm:gap-6">
            <Sheet open={navOpen} onOpenChange={setNavOpen}>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="sm:hidden"
                    aria-label="Open navigation"
                  />
                }
              >
                <MenuIcon />
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>{teamName ?? "IntrovertHubs"}</SheetTitle>
                  <SheetDescription>
                    {role ? role.toUpperCase() : "Navigation"}
                  </SheetDescription>
                </SheetHeader>
                <nav className="flex flex-col gap-0.5 px-2 pb-4">
                  {links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      onClick={() => setNavOpen(false)}
                      aria-current={current === l.href ? "page" : undefined}
                      className={cn(
                        "rounded-md px-3 py-2.5 text-sm",
                        current === l.href
                          ? "bg-foreground/5 font-medium text-foreground"
                          : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                      )}
                    >
                      {l.label}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>

            <Link href={OVERVIEW} className="font-semibold tracking-tight text-foreground">
              IntrovertHubs
            </Link>

            <nav className="hidden items-center gap-1 sm:flex">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={current === l.href ? "page" : undefined}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm",
                    current === l.href
                      ? "bg-foreground/5 font-medium text-foreground"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                  )}
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
              <span className="hidden text-xs text-muted-foreground sm:inline">
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
      <main className="mx-auto flex w-full max-w-6xl min-h-0 flex-1 flex-col overflow-y-auto px-4 py-8">{children}</main>
    </div>
  );
}
