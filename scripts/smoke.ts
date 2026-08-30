import "dotenv/config";
import { prisma } from "../src/lib/db";
import { auth } from "../src/lib/auth";
import { importRepoDocsForTeam } from "../src/lib/context/ingest";
import { runContextPipeline } from "../src/lib/context/pipeline";
import { cascadeFromTask } from "../src/lib/engine/cascade";
import { extractBusinessRulesHeuristic } from "../src/lib/ai/extract-rules";

async function main() {
  const intent =
    "อยากให้ลูกค้าใช้ coupon ลด 10% แต่ใช้ได้ครั้งเดียว และไม่ให้ลดเกิน 500";
  const extracted = extractBusinessRulesHeuristic(intent);
  console.log("extracted", extracted.businessRules);

  const keys = extracted.businessRules.map((r) => r.key);
  for (const need of ["discount", "usage", "maximum_discount"]) {
    if (!keys.includes(need)) throw new Error(`Missing rule ${need}`);
  }

  const email = `smoke-${Date.now()}@teamhub.local`;
  const password = "smoke-password-123";

  const signUp = await auth.api.signUpEmail({
    body: { name: "Smoke User", email, password },
  });
  if (!signUp.user) throw new Error("signUp failed");

  const team = await prisma.team.create({
    data: {
      name: "Smoke Team",
      slug: `smoke-${Date.now()}`,
      memberships: {
        create: { userId: signUp.user.id, role: "pm" },
      },
    },
  });

  const ingest = await importRepoDocsForTeam(team.id);
  console.log("ingest", ingest);

  const task = await prisma.task.create({
    data: {
      teamId: team.id,
      title: extracted.titleHint,
      requirement: extracted.requirement,
      businessRules: extracted.businessRules as object[],
      acceptanceCriteria: "Coupon applies with extracted rules.",
      requirementPresent: true,
      rulesPresent: true,
      acPresent: true,
      apiReady: true,
      figmaReady: true,
      designLinked: true,
      figmaUrl: "https://figma.com/file/example",
      internalDocPaths: ["knowledge/requirements.md"],
      priority: "p1",
      createdById: signUp.user.id,
      assigneeId: signUp.user.id,
      status: "assigned",
    },
  });

  // Different coupon shape — no schema change
  const other = extractBusinessRulesHeuristic(
    "Buy 2 Get 1 free for new customers, minimum order 1000 THB, no stacking",
  );
  if (!other.businessRules.some((r) => r.key === "buy_x_get_y")) {
    throw new Error("Expected buy_x_get_y without schema change");
  }
  console.log("other coupon rules", other.businessRules.map((r) => r.key));

  const result = await runContextPipeline(task);
  console.log("engine status", result.task.status, "readiness", result.task.readinessScore);

  if (result.task.status === "working") {
    throw new Error("Assigned must not become Working automatically");
  }
  if (!result.contextPack.docs.length) {
    throw new Error("Expected docs retrieved from RAG");
  }

  // --- Context Engine: dependency is a hard gate (spec §6 Coupon Frontend) ---
  const devA = await prisma.user.create({
    data: { name: "Dev A", email: `dev-a-${Date.now()}@smoke.local` },
  });
  await prisma.membership.create({
    data: { teamId: team.id, userId: devA.id, role: "backend" },
  });

  const couponApi = await prisma.task.create({
    data: {
      teamId: team.id,
      title: "Coupon API",
      requirement: "Expose coupon validation endpoint.",
      acceptanceCriteria: "POST /coupons/validate returns discount.",
      createdById: signUp.user.id,
      assigneeId: devA.id,
      status: "working",
    },
  });
  await prisma.taskDependency.create({
    data: { dependentId: task.id, dependencyId: couponApi.id, source: "manual" },
  });

  const blocked = await runContextPipeline(
    await prisma.task.findUniqueOrThrow({ where: { id: task.id } }),
  );
  console.log(
    "blocked run:",
    blocked.task.status,
    "readiness",
    blocked.task.readinessScore,
    "|",
    blocked.engineOutput.waitingFor,
  );
  if (blocked.engineOutput.status !== "blocked") {
    throw new Error(
      `Unfinished dependency must block, got ${blocked.engineOutput.status} at readiness ${blocked.engineOutput.readinessScore}`,
    );
  }
  if (blocked.engineOutput.blockedBy[0]?.assigneeName !== "Dev A") {
    throw new Error("Blocked task must name the dependency owner");
  }

  // Dependency completes → cascade re-evaluates the dependent with NO Claude call
  await prisma.task.update({ where: { id: couponApi.id }, data: { status: "done" } });
  const cascade = await cascadeFromTask(couponApi.id);
  console.log(
    "cascade:",
    cascade.map((c) => `${c.task.title} ${c.previousStatus}→${c.status}`).join(", ") || "(none)",
  );
  const frontendResult = cascade.find((c) => c.task.id === task.id);
  if (!frontendResult?.changed || frontendResult.status === "blocked") {
    throw new Error("Completed dependency must cascade the dependent out of BLOCKED");
  }

  const notifications = await prisma.notification.findMany({
    where: { taskId: task.id, userId: signUp.user.id },
    orderBy: { createdAt: "desc" },
  });
  console.log("notifications:", notifications.map((n) => n.title));
  if (!notifications.some((n) => n.type === "task_unblocked")) {
    throw new Error("Owner must be notified when their task is unblocked");
  }

  console.log("SMOKE_OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
