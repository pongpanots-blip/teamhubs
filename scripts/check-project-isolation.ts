/**
 * Proves the project boundary holds. Seeds one team with two projects and two
 * non-PM devs (one per project) plus a PM, then asserts what each can reach.
 *
 * Run against a local DB: `pnpm tsx scripts/check-project-isolation.ts`.
 * Everything it creates is removed at the end, pass or fail.
 */
import "dotenv/config";
import { prisma } from "../src/lib/db";
import {
  projectAccess,
  listAccessibleProjects,
  requireProjectById,
  type AuthContext,
} from "../src/lib/auth-session";
import { requireTaskAccess, assertAssignable } from "../src/lib/tasks/access";

const TAG = `isolation-${Date.now()}`;

function assert(condition: boolean, label: string) {
  if (!condition) throw new Error(`FAIL - ${label}`);
  console.log(`ok - ${label}`);
}

async function rejects(fn: () => Promise<unknown>, message: string, label: string) {
  try {
    await fn();
  } catch (e) {
    assert(e instanceof Error && e.message === message, `${label} (threw ${message})`);
    return;
  }
  throw new Error(`FAIL - ${label}: expected ${message}, resolved instead`);
}

/** The shape route handlers get from requireMembership(). */
function ctx(user: { id: string }, membership: unknown): AuthContext {
  return { user, membership } as AuthContext;
}

async function main() {
  const team = await prisma.team.create({
    data: { name: `Team ${TAG}`, slug: TAG },
  });

  const [alpha, beta] = await Promise.all([
    prisma.project.create({ data: { teamId: team.id, name: "Alpha", slug: `${TAG}-alpha` } }),
    prisma.project.create({ data: { teamId: team.id, name: "Beta", slug: `${TAG}-beta` } }),
  ]);

  async function makeUser(name: string, role: "pm" | "backend", projectId?: string) {
    const user = await prisma.user.create({
      data: { name, email: `${name}.${TAG}@example.test` },
    });
    const membership = await prisma.membership.create({
      data: { teamId: team.id, userId: user.id, role },
      include: { team: true },
    });
    if (projectId) {
      await prisma.projectMembership.create({
        data: { projectId, userId: user.id, role },
      });
    }
    return ctx(user, membership);
  }

  const pm = await makeUser("pm", "pm");
  const devA = await makeUser("deva", "backend", alpha.id);
  const devB = await makeUser("devb", "backend", beta.id);

  const taskA = await prisma.task.create({
    data: {
      teamId: team.id,
      projectId: alpha.id,
      title: "Alpha task",
      createdById: pm.user.id,
    },
  });

  // 1) A dev cannot reach another project, by slug or by task id.
  assert((await projectAccess(devA, beta)) === null, "dev in Alpha has no access to Beta");
  await rejects(
    () => requireProjectById(devB, alpha.id),
    "NOT_FOUND",
    "dev in Beta gets NOT_FOUND for Alpha",
  );
  await rejects(
    () => requireTaskAccess(devB, taskA.id),
    "NOT_FOUND",
    "dev in Beta gets NOT_FOUND for a task in Alpha",
  );
  assert(
    (await requireTaskAccess(devA, taskA.id)).project.id === alpha.id,
    "dev in Alpha can reach their own task",
  );

  // 2) The switcher only lists what you can open.
  const devAProjects = await listAccessibleProjects(devA);
  assert(
    devAProjects.length === 1 && devAProjects[0].id === alpha.id,
    "dev in Alpha only sees Alpha",
  );
  const pmProjects = await listAccessibleProjects(pm);
  assert(
    pmProjects.filter((p) => p.teamId === team.id).length === 2,
    "team PM sees both projects",
  );

  // 3) Notifications do not cross the boundary.
  await prisma.notification.createMany({
    data: [
      {
        teamId: team.id,
        projectId: alpha.id,
        userId: devB.user.id,
        taskId: taskA.id,
        type: "task_assigned",
        title: "Alpha ping",
        body: "",
      },
    ],
  });
  const devBVisible = await prisma.notification.findMany({
    where: {
      userId: devB.user.id,
      projectId: { in: (await listAccessibleProjects(devB)).map((p) => p.id) },
    },
  });
  assert(devBVisible.length === 0, "a notification in Alpha is invisible to a Beta-only dev");

  // 4) Work cannot be assigned to someone who could never open it.
  await rejects(
    () => assertAssignable(alpha.id, devB.user.id),
    "ASSIGNEE_NOT_IN_PROJECT",
    "cannot assign an Alpha task to a Beta-only dev",
  );
  await assertAssignable(alpha.id, devA.user.id);
  console.log("ok - can assign an Alpha task to an Alpha dev");

  // 5) PM override reaches both projects but is not a project membership.
  const pmOnBeta = await projectAccess(pm, beta);
  assert(
    pmOnBeta !== null && pmOnBeta.projectMembership === null && pmOnBeta.role === "pm",
    "team PM reaches Beta by override, with pm role",
  );
}

main()
  .then(() => console.log("\nAll project-isolation checks passed."))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    const team = await prisma.team.findUnique({ where: { slug: TAG } });
    if (team) {
      // Users are not team-cascaded, so remove them explicitly.
      const members = await prisma.membership.findMany({ where: { teamId: team.id } });
      await prisma.team.delete({ where: { id: team.id } });
      await prisma.user.deleteMany({ where: { id: { in: members.map((m) => m.userId) } } });
    }
    await prisma.$disconnect();
  });
