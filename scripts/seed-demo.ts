/**
 * Seed a demo team with one account per role, a project with a live sprint,
 * and a spread of tasks across every status — so the UI walkthrough
 * (e2e/walkthrough.spec.ts) and anyone poking at the app has real data.
 *
 * Idempotent: re-running deletes and recreates the demo team; demo users are
 * reused when they already exist.
 *
 *   pnpm seed:demo
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import type { TaskComponent, TaskPriority, TaskStatus, TeamRole } from "@prisma/client";
import { prisma } from "../src/lib/db";
import { auth } from "../src/lib/auth";
import { allocateTaskNumber } from "../src/lib/tasks/next-task-number";
import { recordStatusChange } from "../src/lib/tasks/status-history";
import { DEMO_PASSWORD, DEMO_PROJECT_SLUG, DEMO_TEAM_SLUG, DEMO_USERS } from "../e2e/demo-accounts";

type Seed = {
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  component: TaskComponent | null;
  assignee: TeamRole | null;
  points: number | null;
  inSprint: boolean;
  requirement?: string;
  acceptanceCriteria?: string;
};

const TASKS: Seed[] = [
  { title: "เชื่อม payment gateway v2", status: "working", priority: "p0", component: "backend", assignee: "backend", points: 8, inSprint: true,
    requirement: "รับชำระผ่าน gateway v2 พร้อม fallback ไป v1 เมื่อ v2 ล่ม", acceptanceCriteria: "ชำระเงินสำเร็จทั้ง v1/v2 และมี log ทุก transaction" },
  { title: "หน้า Checkout ใหม่ตาม Figma", status: "working", priority: "p1", component: "ui", assignee: "ui", points: 5, inSprint: true,
    requirement: "Redesign หน้า checkout 3 ขั้นตอน", acceptanceCriteria: "ตรง Figma ทุก state (empty/loading/error)" },
  { title: "Coupon ลด 10% ใช้ได้ครั้งเดียว ไม่เกิน 500", status: "review", priority: "p1", component: "website", assignee: "website", points: 3, inSprint: true,
    requirement: "คูปองลด 10% ต่อออเดอร์ ใช้ได้ครั้งเดียวต่อบัญชี", acceptanceCriteria: "ส่วนลดไม่เกิน 500 บาท และใช้ซ้ำไม่ได้" },
  { title: "Push notification เมื่อออเดอร์ถูกจัดส่ง", status: "assigned", priority: "p2", component: "mobile", assignee: "mobile", points: 3, inSprint: true },
  { title: "AI แนะนำสินค้าในตะกร้า", status: "blocked", priority: "p2", component: "ai", assignee: "ai", points: 5, inSprint: true,
    requirement: "แนะนำสินค้าเพิ่มจากประวัติซื้อ", acceptanceCriteria: "แสดงไม่เกิน 4 รายการ ตอบภายใน 300ms" },
  { title: "แก้ bug pagination หน้ารายการใบแจ้งหนี้", status: "done", priority: "p1", component: "website", assignee: "website", points: 2, inSprint: true },
  { title: "Rate limit endpoint /api/orders", status: "done", priority: "p2", component: "backend", assignee: "backend", points: 2, inSprint: true },
  { title: "Empty state หน้า Orders", status: "ready", priority: "p3", component: "ui", assignee: null, points: 1, inSprint: false,
    requirement: "ภาพ + ข้อความเมื่อยังไม่มีออเดอร์", acceptanceCriteria: "แสดง CTA ไปหน้าสินค้า" },
  { title: "Deep link เปิดหน้าสินค้าจาก LINE", status: "not_ready", priority: "p2", component: "mobile", assignee: null, points: null, inSprint: false },
  { title: "Dashboard ยอดขายรายวันสำหรับแอดมิน", status: "not_ready", priority: "p3", component: null, assignee: null, points: null, inSprint: false },
];

function mondayOfThisWeek(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - ((day + 6) % 7));
  return d;
}

async function ensureUser(u: (typeof DEMO_USERS)[number]) {
  const existing = await prisma.user.findUnique({ where: { email: u.email } });
  if (existing) return existing;
  const signUp = await auth.api.signUpEmail({
    body: { name: u.name, email: u.email, password: DEMO_PASSWORD },
  });
  if (!signUp.user) throw new Error(`signUp failed for ${u.email}`);
  return prisma.user.findUniqueOrThrow({ where: { id: signUp.user.id } });
}

async function main() {
  // Wipe and rebuild the demo team; everything under it cascades.
  await prisma.team.deleteMany({ where: { slug: DEMO_TEAM_SLUG } });

  const users = new Map<TeamRole, { id: string; name: string; email: string }>();
  for (const u of DEMO_USERS) users.set(u.role, await ensureUser(u));
  const pm = users.get("pm")!;

  const team = await prisma.team.create({
    data: {
      name: "Demo Team",
      slug: DEMO_TEAM_SLUG,
      memberships: {
        create: DEMO_USERS.map((u) => ({ userId: users.get(u.role)!.id, role: u.role })),
      },
      projects: {
        create: {
          name: "Checkout",
          slug: DEMO_PROJECT_SLUG,
          keyPrefix: "CHK",
          memberships: {
            create: DEMO_USERS.map((u) => ({ userId: users.get(u.role)!.id, role: u.role })),
          },
        },
      },
    },
    include: { projects: true },
  });
  const project = team.projects[0]!;

  const start = mondayOfThisWeek();
  const end = new Date(start);
  end.setDate(end.getDate() + 11); // two working weeks, ends Friday
  end.setHours(23, 59, 59, 0);
  const sprint = await prisma.sprint.create({
    data: {
      projectId: project.id,
      name: "Sprint 24 — Q3 Wk2",
      goal: "ปิด checkout flow ให้ครบก่อนเปิดตัว payment v2",
      startAt: start,
      endAt: end,
      startedAt: start,
      committedPoints: TASKS.filter((t) => t.inSprint).reduce((s, t) => s + (t.points ?? 0), 0),
    },
  });

  const createdIds: string[] = [];
  for (const t of TASKS) {
    const assigneeId = t.assignee ? users.get(t.assignee)!.id : null;
    const requirement = t.requirement ?? "";
    const ac = t.acceptanceCriteria ?? "";
    const task = await prisma.$transaction(async (tx) => {
      const { taskNumber } = await allocateTaskNumber(tx, project.id);
      return tx.task.create({
        data: {
          teamId: team.id,
          projectId: project.id,
          taskNumber,
          title: t.title,
          requirement,
          acceptanceCriteria: ac,
          requirementPresent: Boolean(requirement),
          acPresent: Boolean(ac),
          status: t.status,
          priority: t.priority,
          component: t.component,
          assigneeId,
          createdById: pm.id,
          storyPoints: t.points,
          estimateHours: t.points,
          sprintId: t.inSprint ? sprint.id : null,
          figmaUrl: t.component === "ui" ? "https://www.figma.com/file/demo/checkout" : null,
          designLinked: t.component === "ui",
          figmaReady: t.component === "ui",
          apiReady: t.status !== "not_ready",
        },
      });
    });
    await recordStatusChange({ taskId: task.id, from: null, to: t.status, changedById: pm.id });
    createdIds.push(task.id);
  }

  const invite = await prisma.invite.create({
    data: {
      teamId: team.id,
      projectId: project.id,
      email: "demo-newcomer@introverthubs.local",
      role: "backend",
      projectRole: "backend",
      invitedById: pm.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    },
  });

  const state = {
    teamSlug: DEMO_TEAM_SLUG,
    projectSlug: DEMO_PROJECT_SLUG,
    sprintId: sprint.id,
    taskIds: createdIds,
    inviteToken: invite.token,
  };
  const out = path.join(process.cwd(), "e2e", "demo-state.json");
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(state, null, 2));

  console.log("Demo team seeded.");
  console.table(DEMO_USERS.map((u) => ({ role: u.role, email: u.email, password: DEMO_PASSWORD })));
  console.log(`project: /app/${DEMO_PROJECT_SLUG}   tasks: ${createdIds.length}   invite: /invite/${invite.token}`);
  console.log(`state written to ${out}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
