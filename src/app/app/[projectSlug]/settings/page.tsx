import { prisma } from "@/lib/db";
import { requireProjectPage } from "@/lib/page-context";
import { ProjectSettingsPanels } from "@/components/settings/project-settings-panels";

type Params = { params: Promise<{ projectSlug: string }> };

export default async function ProjectSettingsPage({ params }: Params) {
  const { projectSlug } = await params;
  const { membership, project, role } = await requireProjectPage(projectSlug);
  const isPm = role === "pm";

  const [providers, projectRow, teamMembers, projectMembers, repositories, figmaFiles] =
    await Promise.all([
      prisma.integrationCredential.findMany({
        where: { projectId: project.id },
        select: { provider: true, updatedAt: true },
      }),
      prisma.project.findUnique({
        where: { id: project.id },
        select: { pluginToken: true },
      }),
      isPm
        ? prisma.membership.findMany({
            where: { teamId: membership.teamId },
            include: { user: { select: { id: true, name: true, email: true } } },
          })
        : Promise.resolve([]),
      isPm
        ? prisma.projectMembership.findMany({ where: { projectId: project.id } })
        : Promise.resolve([]),
      prisma.projectRepository.findMany({
        where: { projectId: project.id },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      }),
      prisma.projectFigmaFile.findMany({
        where: { projectId: project.id },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      }),
    ]);
  const roleByUserId = new Map(projectMembers.map((pm) => [pm.userId, pm.role]));

  return (
    <ProjectSettingsPanels
      isPm={isPm}
      projectId={project.id}
      projectSlug={project.slug}
      projectName={project.name}
      providers={providers.map((p) => ({
        provider: p.provider,
        updatedAt: p.updatedAt.toISOString(),
      }))}
      hasPluginToken={Boolean(projectRow?.pluginToken)}
      teamMembers={teamMembers.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        projectRole: roleByUserId.get(m.user.id) ?? null,
      }))}
      repositories={repositories.map((r) => ({
        id: r.id,
        owner: r.owner,
        name: r.name,
        defaultBranch: r.defaultBranch,
        pathPrefix: r.pathPrefix,
        isPrimary: r.isPrimary,
      }))}
      figmaFiles={figmaFiles.map((f) => ({
        id: f.id,
        fileKey: f.fileKey,
        name: f.name,
        isPrimary: f.isPrimary,
      }))}
    />
  );
}
