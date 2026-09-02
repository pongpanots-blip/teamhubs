import { AppShell } from "@/components/layout/app-shell";
import { requireProjectPage } from "@/lib/page-context";

/**
 * Owns the chrome for every project page, so the pages themselves only
 * fetch and render their own data.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectSlug: string }>;
}) {
  const { projectSlug } = await params;
  const { user, membership, projects, project, role } = await requireProjectPage(projectSlug);

  return (
    <AppShell
      teamName={membership.team.name}
      role={role}
      projects={projects.map((p) => ({ slug: p.slug, name: p.name }))}
      currentProjectSlug={project.slug}
      userName={user.name}
    >
      {children}
    </AppShell>
  );
}
