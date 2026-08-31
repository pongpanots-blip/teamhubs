import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { GrillChat } from "@/components/tasks/grill-chat";

type Params = { params: Promise<{ projectSlug: string }> };

export default async function NewTaskPage({ params }: Params) {
  const { projectSlug } = await params;
  const { project, projects } = await requireProjectPage(projectSlug);

  // Members of every project the viewer can open — a grilling draft stays
  // locked to the project it was started in, so its assignee dropdown must
  // filter by *that* project even when the page was opened from another one.
  const members = await prisma.projectMembership.findMany({
    where: { projectId: { in: projects.map((p) => p.id) } },
    include: { user: { select: { id: true, name: true } } },
  });

  const slugByProjectId = new Map(projects.map((p) => [p.id, p.slug]));

  return (
    <GrillChat
      projects={projects.map((p) => ({ slug: p.slug, name: p.name }))}
      currentProjectSlug={project.slug}
      members={members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        role: m.role,
        projectSlug: slugByProjectId.get(m.projectId) ?? "",
      }))}
    />
  );
}
