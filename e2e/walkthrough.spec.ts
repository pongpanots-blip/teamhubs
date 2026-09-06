/**
 * Walks through the app as every demo role, screenshots each screen and
 * writes a self-contained Thai user guide to docs/walkthrough/index.html.
 *
 *   pnpm seed:demo        # once — creates the demo team/accounts/tasks
 *   pnpm walkthrough      # starts the dev server if needed, then runs this
 */
import { test, expect, type Page, type Browser } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DEMO_PASSWORD, DEMO_PROJECT_SLUG, DEMO_USERS, type DemoRole } from "./demo-accounts";

type DemoState = { projectSlug: string; taskIds: string[]; inviteToken: string };

type Step = {
  id: string;
  title: string;
  who: string;
  url: string;
  howTo: string[];
  note?: string;
  file?: string;
  error?: string;
};

const OUT_DIR = path.join(process.cwd(), "docs", "walkthrough");
const SHOTS_DIR = path.join(OUT_DIR, "shots");
const STATE_FILE = path.join(process.cwd(), "e2e", "demo-state.json");

const steps: Step[] = [];
let shotIndex = 0;

function loadState(): DemoState {
  if (!existsSync(STATE_FILE)) {
    throw new Error(`Missing ${STATE_FILE} — run \`pnpm seed:demo\` first.`);
  }
  return JSON.parse(readFileSync(STATE_FILE, "utf8")) as DemoState;
}

async function settle(page: Page) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
}

async function capture(page: Page, step: Omit<Step, "file">, action?: () => Promise<void>) {
  const entry: Step = { ...step };
  try {
    if (!page.url().endsWith(step.url)) {
      await page.goto(step.url);
    }
    await settle(page);
    if (action) {
      await action();
      await settle(page);
    }
    shotIndex += 1;
    const file = `${String(shotIndex).padStart(2, "0")}-${step.id}.png`;
    await page.screenshot({ path: path.join(SHOTS_DIR, file), fullPage: true });
    entry.file = file;
  } catch (err) {
    entry.error = err instanceof Error ? err.message.split("\n")[0] : String(err);
  }
  steps.push(entry);
}

async function login(page: Page, role: DemoRole) {
  const u = DEMO_USERS.find((x) => x.role === role)!;
  await page.goto("/login");
  await page.locator("#email").fill(u.email);
  await page.locator("#password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/app/, { timeout: 90_000 });
  await settle(page);
}

test.beforeAll(() => {
  mkdirSync(SHOTS_DIR, { recursive: true });
});

test("public pages: login, register, invite", async ({ page }) => {
  const state = loadState();
  await capture(page, {
    id: "login",
    title: "หน้า Sign in",
    who: "ทุกคน",
    url: "/login",
    howTo: ["กรอก email / password ของบัญชี demo (ตารางด้านบน)", "กด Sign in แล้วระบบพาไป /app"],
  });
  await capture(page, {
    id: "register",
    title: "หน้า Register",
    who: "ผู้ใช้ใหม่",
    url: "/register",
    howTo: ["กรอกชื่อ, email, password (8 ตัวขึ้นไป)", "สมัครแล้วจะไปหน้า onboarding เพื่อสร้างทีม หรือกลับไปหน้า invite ถ้ามาจากลิงก์เชิญ"],
  });
  await capture(page, {
    id: "invite-logged-out",
    title: "หน้า Join team (ยังไม่ login)",
    who: "คนที่ได้รับลิงก์เชิญ",
    url: `/invite/${state.inviteToken}`,
    howTo: [
      "หน้าจะบอกว่าคำเชิญนี้เป็นของ email ไหน",
      "กด Register หรือ Sign in — email ถูกกรอกให้ล่วงหน้า และหลัง auth จะเด้งกลับมาหน้านี้",
      "ถ้า login ด้วย email อื่นอยู่ ระบบเสนอให้ sign out ก่อน (แก้ปัญหา EMAIL_MISMATCH ที่ไม่มีช่องให้ใส่ email)",
    ],
  });
});

test("PM walkthrough", async ({ page }) => {
  const state = loadState();
  const p = `/app/${state.projectSlug ?? DEMO_PROJECT_SLUG}`;
  await login(page, "pm");

  await capture(page, {
    id: "overview",
    title: "Overview (ระดับทีม)",
    who: "PM / ทุก role",
    url: "/app",
    howTo: [
      "Sidebar ซ้าย: Reading → Overview ทีม, เมนูโปรเจกต์ (Overview / Tasks / Sprints / Docs / Settings)",
      "การ์ดโปรเจกต์ทั้งหมด, My Work, งานที่ต้อง Attention, ตัวกรอง/จัดกลุ่มรายการข้ามโปรเจกต์",
    ],
  });
  await capture(page, {
    id: "project-overview",
    title: "Project Overview + Flow metrics",
    who: "PM",
    url: p,
    howTo: [
      "กราฟ Tasks by status, Sprint velocity (capacity จาก headcount UI+dev × 7 ชม./วัน)",
      "Flow metrics (SLE, aging WIP, cycle time, throughput, CFD, burndown) ย้ายมาอยู่ในหน้านี้แทนหน้า Analytics เดิม",
    ],
  });
  await capture(page, {
    id: "tasks-list",
    title: "Tasks — List",
    who: "PM / dev",
    url: `${p}/tasks`,
    howTo: [
      "ticket key ต่อโปรเจกต์ (CHK-1, CHK-2 …), tag component (UI/Website/Backend/Mobile/AI Dev), avatar ผู้รับผิดชอบ",
      "ตัวกรอง Status / Assignee / Priority / Sprint (มี Backlog) + Clear filters",
    ],
  });
  await capture(
    page,
    {
      id: "tasks-board",
      title: "Tasks — Board",
      who: "PM / dev",
      url: `${p}/tasks`,
      howTo: ["สลับ List ↔ Board ที่มุมขวาบน", "การ์ดแสดง key, tag component, priority, ผู้รับผิดชอบ"],
    },
    async () => {
      await page.getByRole("tab", { name: /^board$/i }).or(page.getByRole("button", { name: /^board$/i })).first().click();
    },
  );
  await capture(
    page,
    {
      id: "quick-task-dialog",
      title: "+ New task → Quick task form (ไม่ผ่าน Grill)",
      who: "PM",
      url: `${p}/tasks`,
      howTo: [
        "กด + New task แล้วเลือกกรอกฟอร์มเร็ว",
        "กรอก title, priority, sprint, assignee, deadline, description แล้วบันทึก — task ได้ key และ status ทันที",
      ],
    },
    async () => {
      await page.getByRole("button", { name: /new task/i }).first().click();
      await page.waitForTimeout(500);
      const quick = page.getByRole("menuitem").filter({ hasText: /ฟอร์ม|quick|form/i }).first();
      if (await quick.isVisible().catch(() => false)) await quick.click();
      await page.waitForTimeout(500);
    },
  );
  await page.keyboard.press("Escape").catch(() => {});
  await capture(page, {
    id: "new-task-grill",
    title: "New task — Grill กับ AI",
    who: "PM",
    url: `${p}/tasks/new`,
    howTo: [
      "แท็บ Grill: พิมพ์ความต้องการ AI จะซักถามจนได้ requirement / business rules / AC แล้วเสนอคำตอบให้กดเลือกได้",
      "จบแล้วมี progress 3 ขั้น (chat → assign → create) เลือกผู้รับผิดชอบจาก person-chips",
    ],
  });
  await capture(
    page,
    {
      id: "new-task-quick-tab",
      title: "New task — แท็บ กรอกฟอร์มเร็ว",
      who: "PM",
      url: `${p}/tasks/new`,
      howTo: ["ฟอร์มเดียวกับ dialog + New task ใช้ logic ร่วมกัน"],
    },
    async () => {
      await page.getByRole("button", { name: /กรอกฟอร์มเร็ว/ }).first().click();
    },
  );
  await capture(page, {
    id: "task-detail",
    title: "Task detail",
    who: "PM / ผู้รับผิดชอบ",
    url: `${p}/tasks/${state.taskIds[0]}`,
    howTo: [
      "หัวข้อแสดง key (CHK-n), status, priority, sprint, ผู้รับผิดชอบ, deadline",
      "requirement / business rules / AC / readiness, sub-tasks, decision log, handoff doc, Run context (RAG)",
      "เปลี่ยน status ได้จากหน้านี้ — ทุกการเปลี่ยนถูก log ลง flow metrics",
    ],
  });
  await capture(page, {
    id: "sprints",
    title: "Sprints — status kanban + capacity bar",
    who: "PM",
    url: `${p}/sprints`,
    howTo: [
      "แผง sprint แสดง kanban ตาม status (จุดสีต่อคอลัมน์) เป็นค่าเริ่มต้น; มีมุมมอง by person / list เป็นแท็บอื่น",
      "แถบ capacity เทียบ committed points กับ capacity จริงของช่วงวันทำงาน",
      "ลากการ์ดจาก backlog เข้า sprint, แก้ชื่อ/goal/วันที่ inline, กำหนด man-hours ต่อการ์ด",
    ],
  });
  await capture(page, {
    id: "docs",
    title: "Docs / RAG",
    who: "PM",
    url: `${p}/docs`,
    howTo: ["อัปโหลด/ingest เอกสารของโปรเจกต์ ใช้เป็น context ตอน Run context ของ task"],
  });
  await capture(page, {
    id: "project-settings",
    title: "Project settings (sub-nav)",
    who: "PM",
    url: `${p}/settings`,
    howTo: [
      "เมนูซ้าย: Members / Integrations / Repositories / Figma files / Figma Plugin — แสดงทีละส่วน",
      "Members: เชิญคนเข้าโปรเจกต์พร้อม role; Repositories/Figma files: ทะเบียน repo และไฟล์ Figma ของโปรเจกต์",
    ],
  });
  await capture(page, {
    id: "team-settings",
    title: "Team settings",
    who: "PM",
    url: "/app/team/settings",
    howTo: ["สร้างโปรเจกต์ใหม่, เชิญสมาชิกระดับทีม, ค่า default ของ AI/embedding"],
  });
});

for (const u of DEMO_USERS.filter((x) => x.role !== "pm")) {
  test(`${u.label} view`, async ({ page }) => {
    const state = loadState();
    await login(page, u.role);
    await capture(page, {
      id: `role-${u.role}`,
      title: `มุมมอง ${u.label} (${u.email})`,
      who: u.label,
      url: `/app/${state.projectSlug ?? DEMO_PROJECT_SLUG}/tasks`,
      howTo: [
        `login ด้วย ${u.email} / ${DEMO_PASSWORD}`,
        "เห็นเฉพาะโปรเจกต์ที่เป็นสมาชิก; เมนู Team settings และปุ่มระดับ PM ถูกซ่อน",
        "งานของตัวเองขึ้นใน My Work บนหน้า Overview; เปลี่ยน status ของ task ตัวเองได้จาก task detail",
      ],
    });
  });
}

test.afterAll(() => {
  writeFileSync(path.join(OUT_DIR, "steps.json"), JSON.stringify(steps, null, 2));
  writeFileSync(path.join(OUT_DIR, "index.html"), renderHtml(steps));
  const failed = steps.filter((s) => s.error);
  console.log(`walkthrough: ${steps.length - failed.length}/${steps.length} screens captured → docs/walkthrough/index.html`);
  for (const f of failed) console.log(`  ! ${f.id}: ${f.error}`);
  expect(steps.length).toBeGreaterThan(0);
});

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderHtml(list: Step[]): string {
  const accounts = DEMO_USERS.map(
    (u) => `<tr><td>${u.label}</td><td><code>${u.email}</code></td><td><code>${DEMO_PASSWORD}</code></td><td>${esc(u.name)}</td></tr>`,
  ).join("");
  const toc = list.map((s, i) => `<li><a href="#s${i + 1}">${i + 1}. ${esc(s.title)}</a></li>`).join("");
  const sections = list
    .map((s, i) => {
      const img = s.file
        ? `<a href="shots/${s.file}" target="_blank"><img src="data:image/png;base64,${readFileSync(path.join(SHOTS_DIR, s.file)).toString("base64")}" alt="${esc(s.title)}"></a>`
        : `<p class="err">ถ่ายภาพไม่สำเร็จ: ${esc(s.error ?? "")}</p>`;
      return `<section id="s${i + 1}">
  <h2>${i + 1}. ${esc(s.title)}</h2>
  <p class="meta"><span>ใคร: ${esc(s.who)}</span> <span>URL: <code>${esc(s.url)}</code></span></p>
  <ol>${s.howTo.map((h) => `<li>${esc(h)}</li>`).join("")}</ol>
  ${s.note ? `<p class="note">${esc(s.note)}</p>` : ""}
  ${img}
</section>`;
    })
    .join("\n");
  const generated = new Date().toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
  return `<!doctype html>
<html lang="th"><head><meta charset="utf-8"><title>IntrovertHubs — คู่มือใช้งาน (walkthrough)</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  :root{color-scheme:light;--fg:#111;--muted:#666;--line:#e5e5e5;--acc:#0070f3}
  body{margin:0;font:15px/1.6 Prompt,Kanit,system-ui,sans-serif;color:var(--fg);background:#fff}
  header{padding:32px 40px;border-bottom:1px solid var(--line)}
  header h1{margin:0 0 6px;font-size:26px} header p{margin:0;color:var(--muted)}
  main{max-width:1200px;margin:0 auto;padding:24px 40px 80px}
  table{border-collapse:collapse;width:100%;margin:12px 0 24px} td,th{border:1px solid var(--line);padding:8px 10px;text-align:left}
  th{background:#fafafa} code{background:#f4f4f4;padding:1px 5px;border-radius:4px;font-family:"JetBrains Mono",ui-monospace,monospace;font-size:13px}
  pre{background:#0b0b0b;color:#eee;padding:14px 16px;border-radius:6px;overflow:auto;font-size:13px}
  nav ol{columns:2;padding-left:20px} nav a{color:var(--acc);text-decoration:none}
  section{margin-top:48px;padding-top:24px;border-top:1px solid var(--line)}
  section h2{font-size:20px;margin:0 0 4px} .meta{color:var(--muted);font-size:13px;margin:0 0 8px} .meta span{margin-right:16px}
  section img{width:100%;border:1px solid var(--line);border-radius:6px;margin-top:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
  .err{color:#ee0000} .note{background:#fff8e1;padding:8px 12px;border-radius:6px}
</style></head><body>
<header><h1>IntrovertHubs — คู่มือใช้งานพร้อมภาพหน้าจอ</h1><p>สร้างอัตโนมัติด้วย Playwright เมื่อ ${generated} · ${list.filter((s) => s.file).length}/${list.length} หน้าจอ</p></header>
<main>
<h2>1) ติดตั้งและรัน</h2>
<pre>cp .env.example .env        # ตั้ง DATABASE_URL, GEMINI_API_KEY(S)
pnpm install
pnpm db:up                  # Postgres + pgvector (Docker) หรือใช้ Postgres ในเครื่อง
pnpm db:migrate             # prisma migrate dev
pnpm seed:demo              # สร้างทีม demo + บัญชีทุก role + sprint + tasks
pnpm dev                    # http://localhost:3000</pre>
<h2>2) บัญชีทดสอบ (1 บัญชี / role)</h2>
<table><thead><tr><th>Role</th><th>Email</th><th>Password</th><th>ชื่อ</th></tr></thead><tbody>${accounts}</tbody></table>
<p>ทีม <code>demo-team</code> · โปรเจกต์ <code>Checkout</code> (key <code>CHK</code>) · สร้างใหม่ทุกครั้งที่รัน <code>pnpm seed:demo</code></p>
<h2>3) สร้างคู่มือนี้ใหม่</h2>
<pre>pnpm walkthrough            # รัน Playwright (เปิด dev server ให้เองถ้ายังไม่เปิด) → docs/walkthrough/index.html</pre>
<h2>4) หน้าจอทั้งหมด</h2>
<nav><ol>${toc}</ol></nav>
${sections}
</main></body></html>`;
}
