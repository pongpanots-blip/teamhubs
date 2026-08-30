import "dotenv/config";
import { prisma } from "../src/lib/db";
import { importRepoDocsForTeam } from "../src/lib/context/ingest";

async function main() {
  const teamSlug = process.argv[2];
  if (!teamSlug) {
    console.error("Usage: pnpm docs:ingest <team-slug>");
    process.exit(1);
  }
  const team = await prisma.team.findUnique({ where: { slug: teamSlug } });
  if (!team) {
    console.error("Team not found");
    process.exit(1);
  }
  const result = await importRepoDocsForTeam(team.id);
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
