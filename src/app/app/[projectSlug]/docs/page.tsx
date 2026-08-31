import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { DocsIngestPanel, type TeamDocSummary } from "@/components/docs/docs-ingest-panel";

type Params = { params: Promise<{ projectSlug: string }> };

export default async function DocsPage({ params }: Params) {
  const { projectSlug } = await params;
  const { project } = await requireProjectPage(projectSlug);

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

  return <DocsIngestPanel initialDocs={initialDocs} projectSlug={project.slug} />;
}
