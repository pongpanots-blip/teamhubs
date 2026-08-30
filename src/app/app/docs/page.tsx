import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-session";
import { resolveCurrentProject } from "@/lib/current-project";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/layout/app-shell";
import { DocsIngestPanel, type TeamDocSummary } from "@/components/docs/docs-ingest-panel";

export default async function DocsPage() {
  const session = await getSession();
  if (!session?.user) redirect("/login");
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { team: true },
  });
  if (!membership) redirect("/onboarding");

  const { project, projects } = await resolveCurrentProject(membership);
  if (!project) redirect("/onboarding");

  const [docs, counts] = await Promise.all([
    prisma.teamDoc.findMany({
      where: { projectId: project.id },
      orderBy: { path: "asc" },
      select: { path: true, title: true, source: true, sizeBytes: true, indexedAt: true },
    }),
    prisma.docChunk.groupBy({
      by: ["sourcePath"],
      where: { projectId: project.id },
      _count: { id: true },
    }),
  ]);
  const chunkByPath = new Map(counts.map((c) => [c.sourcePath, c._count.id]));

  const initialDocs: TeamDocSummary[] = docs.map((d) => ({
    path: d.path,
    title: d.title,
    source: d.source,
    sizeBytes: d.sizeBytes,
    indexedAt: d.indexedAt?.toISOString() ?? null,
    chunks: chunkByPath.get(d.path) ?? 0,
  }));

  return (
    <AppShell
      teamName={membership.team.name}
      role={membership.role}
      projects={projects}
      currentProjectSlug={project.slug}
    >
      <DocsIngestPanel initialDocs={initialDocs} />
    </AppShell>
  );
}
