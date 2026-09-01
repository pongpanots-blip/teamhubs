/**
 * One-off: fill actualHours for cards that finished before the field became
 * derived.
 *
 * This overwrites values someone typed by hand. That is intended — the field is
 * read-only now, and leaving two kinds of number in the same column with no way
 * to tell them apart is worse than replacing the old ones. Run it once, read the
 * summary, and check a few cards before trusting the totals.
 *
 *   pnpm backfill:actual-hours          # report only
 *   pnpm backfill:actual-hours --write  # actually write
 */
import { prisma } from "../src/lib/db";
import { recomputeActualHours } from "../src/lib/tasks/recompute-actual-hours";

const write = process.argv.includes("--write");

async function main() {
  const done = await prisma.task.findMany({
    where: { status: "done" },
    select: { id: true, title: true, actualHours: true, actualHoursSource: true },
    orderBy: { updatedAt: "desc" },
  });

  console.log(`${done.length} finished card(s)${write ? "" : " — dry run, nothing will be written"}\n`);

  const tally = { commits: 0, status: 0, skipped: 0 };

  for (const task of done) {
    if (!write) {
      // Dry run still reports what each card currently holds, so the diff after
      // a real run is visible rather than a surprise.
      console.log(
        `      ${task.actualHours ?? "—"}h (${task.actualHoursSource ?? "hand-entered"})  ${task.title}`,
      );
      continue;
    }
    const result = await recomputeActualHours(task.id);
    if (!result) {
      tally.skipped++;
      console.log(`skip  ${task.title} — no commits and never entered Working`);
      continue;
    }
    tally[result.source]++;
    const before = task.actualHours ?? "—";
    console.log(`ok    ${before}h → ${result.hours}h (${result.source})  ${task.title}`);
  }

  if (write) {
    console.log(
      `\nfrom commits: ${tally.commits} · from status time: ${tally.status} · skipped: ${tally.skipped}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
