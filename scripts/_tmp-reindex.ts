import "dotenv/config";
import { prisma } from "../src/lib/db";
import { reindexTeamDocs } from "../src/lib/context/ingest";

async function main() {
  const projectId = process.argv[2];
  if (!projectId) {
    console.error("Usage: tsx scripts/_tmp-reindex.ts <projectId>");
    process.exit(1);
  }
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) throw new Error("Project not found");
  console.log("Re-indexing project:", project.name, project.id);
  const result = await reindexTeamDocs(project.id);
  console.log(result);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
