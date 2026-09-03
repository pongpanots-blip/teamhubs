"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/notification-bell";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  /** Absent on team-level pages (overview, team settings) — they show no project tabs. */
  currentProjectSlug?: string;
  userName?: string;
}) {
  const pathname = usePathname();

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
  const projectInitials = (currentProjectName ?? teamName ?? "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-(image:--canvas-app)">
      <header className="sticky top-0 z-10 flex-none border-b border-border bg-card/70 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-2.5 sm:px-6">
          <Link
            href={OVERVIEW}
            className="shrink-0 text-[13px] leading-tight font-semibold tracking-tight text-foreground font-[family-name:var(--font-fraunces)]"
          >
            Introvert<span className="text-primary italic">Hubs</span>
          </Link>

          {currentProjectSlug ? (
            <>
              <span className="h-4 w-px shrink-0 bg-border" />
              <Link
                href={OVERVIEW}
                className="flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-accent"
              >
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-md text-[10px] font-bold text-white"
                  style={{
                    backgroundImage:
                      "linear-gradient(155deg, var(--primary), var(--violet))",
                  }}
                >
                  {projectInitials}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] leading-none text-muted-foreground">
                    Projects
                  </span>
                  <span className="block truncate text-[13px] leading-tight font-semibold text-foreground">
                    {currentProjectName ?? "—"}
                  </span>
                </span>
              </Link>
            </>
          ) : null}

          <div className="flex-1" />

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-xs font-semibold text-foreground font-[family-name:var(--font-fraunces)]"
              aria-label="Account menu"
            >
              {(userName ?? teamName ?? "?").charAt(0).toUpperCase()}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-2 py-1.5">
                <p className="truncate text-sm font-medium">{userName ?? "—"}</p>
                {teamName ? (
                  <p className="truncate text-xs text-muted-foreground">{teamName}</p>
                ) : null}
              </div>
              {role === "pm" ? (
                <DropdownMenuItem render={<Link href={TEAM_SETTINGS} />}>
                  Team settings
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem
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
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {links.length > 0 ? (
          <nav className="flex gap-5 overflow-x-auto px-4 sm:px-6">
            {links.map((l) => {
              const active = current === l.href;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px shrink-0 border-b-2 py-2.5 text-[13px] font-medium whitespace-nowrap",
                    active
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-8 sm:px-6">
        <div className="mx-auto w-full max-w-[1440px]">{children}</div>
      </main>
    </div>
  );
}
