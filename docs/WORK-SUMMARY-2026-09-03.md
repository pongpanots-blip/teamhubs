# IntrovertHubs — สรุปงานทั้งหมด (30 ส.ค. – 3 ก.ย. 2026)

เอกสารนี้สรุปงานที่ทำใน branch `claude/task-sprint-taskdetail-ui-f6f6fa` (worktree `sprint-task-ui-research-4591e0`)
ตั้งแต่การตั้งค่าโปรเจกต์ → วิธีทำ mockup → การ implement ตาม mockup → วิธีใช้งาน → การสร้างคู่มือ HTML อัตโนมัติด้วย Playwright

- คู่มือใช้งานพร้อมภาพหน้าจอ (gen อัตโนมัติ): [`docs/walkthrough/index.html`](walkthrough/index.html)
- ไฟล์ mockup ต้นทาง: [`docs/mockups/`](mockups/)

---

## 1. Setup — ติดตั้งและรันโปรเจกต์

Stack: Next.js 16 (App Router) + TypeScript + Tailwind 4 + shadcn/ui · PostgreSQL 16 + pgvector · Prisma · Better Auth (email/password) · Gemini (AI) · embeddings local/Voyage/OpenAI

```bash
cp .env.example .env          # DATABASE_URL, BETTER_AUTH_SECRET, GEMINI_API_KEY(S), EMBEDDING_PROVIDER
pnpm install
pnpm db:up                    # Postgres+pgvector ผ่าน Docker (หรือใช้ Postgres ในเครื่องแล้วตั้ง DATABASE_URL)
pnpm db:migrate               # prisma migrate dev
pnpm dev                      # http://localhost:3000
```

สคริปต์ที่มีอยู่แล้ว: `pnpm smoke` (end-to-end ไม่ผ่าน UI), `pnpm check:*` (ตรรกะ business-time / metrics / burndown / capacity), `pnpm snapshot:flow`, `pnpm docs:ingest`

Dev server ในเครื่องนี้เปิดผ่าน `.claude/launch.json` (config `web`, port 3000, autoPort)

---

## 2. วิธีทำ mockup (ขั้นตอนที่ใช้จริง)

ทำ mockup เป็น **HTML หน้าเดียว** ที่วาดทุกหน้าจอบนกระดานเดียว แล้วเปิดใน browser / publish เป็น artifact ให้ดูและคอมเมนต์ก่อนแตะโค้ดจริง

| ไฟล์ | เนื้อหา | ผลลัพธ์ที่ implement |
|---|---|---|
| `mockups/introverthubs-ui-mockups.html` | design canvas ทุก artboard (Task List, Board, Task detail, Sprints …) จาก session ก่อนหน้า | ความกว้างคอลัมน์/ตัวกรองหน้า Tasks, มุมมอง List/Board |
| `mockups/task-sprint-mockup.html` | Sprint Flow: สร้าง Task → มอบหมายทีม → Sprint kanban → Task detail → ตั้งค่าโปรเจกต์ → ฟีเจอร์แนะนำ | Quick task form, kanban ตาม status + capacity bar, settings sub-nav, progress 3 ขั้นของ Grill |
| `mockups/sidebar-nav-mockup.html` | Masthead sidebar สไตล์นิตยสาร + dashboard Overview | Sidebar ซ้าย (เมนูมีเลขลำดับ), กราฟ Tasks by status, Velocity card |
| `mockups/jira-clickup-mockup.html` | Task board สไตล์ Jira/ClickUp: ticket key, tag component, avatar | ticket key `CHK-142`, epic tag ต่อ component, avatar ในตาราง |

ขั้นตอนต่อ mockup 1 รอบ:

1. **เก็บ requirement** — ถามผู้ใช้ทีละข้อจนชัด (เช่น "dev/ui นับ role ไหน" → ui = role `ui`, dev = website+backend+mobile+ai)
2. **เขียน mockup HTML** ใน scratchpad (CSS ล้วน ไม่มี framework) แล้วเปิด/publish ให้ดู
3. **ผู้ใช้เลือกทิศทาง** — เช่น เลือก Quick task form ก่อน, เลือก "redesign เต็มรูปแบบตาม mockup", เลือก kanban ตาม status แทน workload view
4. **ส่ง subagent สำรวจโค้ดเดิม** (Explore) เพื่อรู้ว่ามี primitive อะไรใช้ซ้ำได้ (เช่น `ChartCard`/`plot.ts`) ก่อนเขียนแผน
5. **เขียนแผนใน plan mode** (`~/.claude/plans/moonlit-forging-glade.md` — "Rebuild page layouts to match the mockup, not just colors") ระบุ non-goals และวิธี verify
6. **Implement เป็น commit เล็ก ๆ** ต่อหน้าจอ แล้ว screenshot เทียบ mockup, รัน `npx tsc --noEmit`
7. **Verify ในเบราว์เซอร์** ด้วย session ทดสอบ แล้วเก็บ session ทิ้ง

---

## 3. สิ่งที่ implement (เรียงตาม commit)

### 3.1 สร้าง Task เร็ว + ทีมงาน
- `19fed85` Quick task form (title/priority/sprint/description) เป็นทางเลือกแทน Grill AI + แก้ชื่อ/goal/วันที่ sprint แบบ inline
- `85adf04`, `6ba17ca` ตัวกรองและจัดกลุ่มโปรเจกต์ในรายการ Overview ข้ามโปรเจกต์
- `c1d87f5` Quick task form ย้ายไปเป็นแท็บ "⚡ กรอกฟอร์มเร็ว" คู่กับ "💬 Grill กับ AI" (ใช้ logic เดียวกับ dialog + New task), person-chips แนะนำผู้รับผิดชอบหลัง Grill, ทะเบียน Repositories / Figma files ต่อโปรเจกต์ (`/api/projects/repos`, `/api/projects/figma-files`)

### 3.2 Redesign ตาม mockup
- `2dee637` dark mode → `32993ad` violet identity (คง Kanit เพราะรองรับไทย) → `a5333af` Netflix palette + รวม Analytics เข้า Overview → `cee65af` **Mono Deploy palette (ปัจจุบัน)**: ขาว/ดำ accent `#0070F3`, radius 6px, ค่าเริ่มต้นเป็น light
- `23a8f39` **Sprint board เป็น status kanban** (`sprint-status-board.tsx`, จุดสีต่อคอลัมน์) + capacity bar; **Project settings เป็น sub-nav** (Members / Integrations / Repositories / Figma files / Figma Plugin); Grill "ready to create" มี progress 3 ขั้น
- `ff4c9d8` แก้ contrast dark mode และ kanban overflow (`min-w-0`)
- `8960553` **Sidebar ซ้ายแบบนิตยสาร** แทน top navbar (`app-shell.tsx`), ลบ `ProjectSwitcher`, กราฟ Tasks by status ใน Project overview (ใช้ `ChartCard`/`plot.ts` เดิม)
- `5b5bb52` **Capacity จาก headcount จริง** (`src/lib/sprint/capacity.ts`): (UI + dev, ไม่นับ PM) × 7 ชม./วัน, 1 point = 1 ชม. → แสดงที่ sprint capacity bar, Velocity card, Sprints header
- `df34a04` **แก้ flow รับคำเชิญ** (EMAIL_MISMATCH ไม่มีช่องใส่ email): `GET /api/invites/[token]` สาธารณะ, หน้า invite แยกกรณี ยังไม่ login / login ผิด email / email ตรง; login/register รับ `?email=` และ `?next=`
- `3d45fcd` ฟอนต์ Kanit → Prompt · `08b930d` ขยายตัวอักษรหน้า Sprints · `a1e4f76` ตัวกรอง Priority/Sprint + label ทุก select · `df9cbeb` pill → rounded-lg, content กว้าง 1440px, ตัด project picker ใน Grill

### 3.3 Task สไตล์ Jira/ClickUp
- `49a7ae9` tag component (UI/Website/Backend/Mobile/AI Dev) บน List + Board, avatar ตัวย่อในคอลัมน์ Owner
- `1ce5798` **ticket key ต่อโปรเจกต์** (`Project.keyPrefix`, `nextTaskNumber`, `Task.taskNumber` จ่ายเลขใน transaction เดียวกับการสร้าง) → `CHK-1`, `CHK-2` … (migration `20260903093000_task_ticket_keys`)

### 3.4 งานรอบนี้ (3 ก.ย.) — คู่มือ + demo data
- `scripts/seed-demo.ts` → `pnpm seed:demo` สร้างทีม `demo-team`, โปรเจกต์ Checkout (`CHK`), 1 บัญชี/role, sprint ที่กำลัง active, 10 tasks ครบทุก status, invite ค้าง 1 รายการ (idempotent ลบแล้วสร้างใหม่)
- `e2e/demo-accounts.ts` รายชื่อบัญชี demo ใช้ร่วมกันระหว่าง seed และ e2e
- `playwright.config.ts` + `e2e/walkthrough.spec.ts` → `pnpm walkthrough` เปิด dev server เอง, login ทุก role, ถ่าย 20 หน้าจอ แล้ว gen `docs/walkthrough/index.html` (ภาพฝังใน HTML ไฟล์เดียว) + `steps.json` + Playwright HTML report
- เพิ่ม devDependency `@playwright/test@1.62.0` (browser ใช้ของที่ติดตั้งไว้แล้วใน `~/Library/Caches/ms-playwright`)
- คัดลอก mockup ทั้ง 4 ไฟล์จาก scratchpad มาไว้ที่ `docs/mockups/` เพื่อไม่ให้หายไปกับ temp dir

---

## 4. วิธีใช้งานระบบ

### 4.1 บัญชีทดสอบ (สร้างด้วย `pnpm seed:demo`)

| Role | Email | Password |
|---|---|---|
| PM | `demo-pm@introverthubs.local` | `Demo1234!` |
| UI | `demo-ui@introverthubs.local` | `Demo1234!` |
| Website | `demo-website@introverthubs.local` | `Demo1234!` |
| Backend | `demo-backend@introverthubs.local` | `Demo1234!` |
| Mobile | `demo-mobile@introverthubs.local` | `Demo1234!` |
| AI Dev | `demo-ai@introverthubs.local` | `Demo1234!` |

### 4.2 Flow หลัก (PM)

1. **Sign in** `/login` → ไป `/app` (Overview ทีม: My Work, การ์ดโปรเจกต์, งานที่ต้อง Attention)
2. **เลือกโปรเจกต์** จาก sidebar → เมนู 01 Overview / 02 Tasks / 03 Sprints / 04 Docs / 05 Settings
3. **สร้าง task**
   - เร็ว: หน้า Tasks กด **+ New task** → กรอก title / priority / sprint / assignee / deadline → Create task (ได้ key `CHK-n` ทันที)
   - ละเอียด: `/tasks/new` แท็บ **Grill กับ AI** พิมพ์ความต้องการ ให้ AI ซักจนได้ requirement / business rules / AC → เลือกผู้รับผิดชอบจาก person-chips → สร้าง (มี sub-task ต่อ component ได้)
4. **มอบหมาย / เปลี่ยน status** ในหน้า Task detail (`assigned` = เจ้าของ, `working` = กำลังทำ; ทุกการเปลี่ยนถูก log เข้า flow metrics)
5. **วางแผน sprint** หน้า Sprints: เขียน goal → สร้าง sprint → ลากการ์ดจาก Backlog เข้า sprint → ใส่ points / est hrs → ดู capacity bar (committed vs capacity) → Start sprint (หลัง start การย้ายการ์ดนับเป็น scope change บน burndown)
6. **ติดตาม** Project overview: Tasks by status, Sprint velocity, Flow metrics (SLE, aging WIP, cycle time, throughput, CFD, burndown — นับเฉพาะวันทำงาน จ.–ศ.)
7. **เชิญสมาชิก** Project settings → Members (หรือ Team settings) → ส่งลิงก์ `/invite/<token>`; ผู้รับต้อง register/sign in ด้วย email เดียวกับคำเชิญ (หน้าจะบอก email และกรอกให้)
8. **เชื่อม repo / Figma** Project settings → Repositories, Figma files, Figma Plugin token; Docs / RAG สำหรับ ingest เอกสารเป็น context ของ task

### 4.3 Flow ของ dev / UI
- Login → เห็นเฉพาะโปรเจกต์ที่เป็นสมาชิก (Team settings และปุ่มระดับ PM ถูกซ่อน)
- งานของตัวเองอยู่ใน **My Work** บน Overview; เปิด task → กด Run context เพื่อดึงเอกสารที่เกี่ยวข้อง → เปลี่ยน status ตามงานจริง
- Sprints: มุมมอง Board (status) / By person / List

---

## 5. Playwright — สร้างคู่มือ HTML อัตโนมัติ

```bash
pnpm seed:demo        # ครั้งแรก หรือเมื่ออยากรีเซ็ต demo data
pnpm walkthrough      # เปิด dev server ถ้ายังไม่เปิด → login ทุก role → ถ่ายภาพ → docs/walkthrough/index.html
```

- ปรับ port: `E2E_PORT=3100 pnpm walkthrough` หรือชี้ server ที่รันอยู่ `E2E_BASE_URL=http://localhost:3000`
- ผลลัพธ์: `docs/walkthrough/index.html` (ไฟล์เดียว เปิดได้ทันที), `docs/walkthrough/shots/*.png`, `docs/walkthrough/steps.json`, Playwright report ใน `docs/walkthrough/playwright-report/` (ถูก gitignore)
- เพิ่มหน้าจอ: เพิ่ม `capture(page, { id, title, who, url, howTo }, action?)` ใน `e2e/walkthrough.spec.ts`; หน้าจอที่ถ่ายไม่สำเร็จจะถูกบันทึกเป็น error ในคู่มือแทนการทำให้ทั้งชุดล้ม
- ผลรันล่าสุด: 7 tests ผ่าน, 20/20 หน้าจอ (รันด้วย `E2E_PORT=3100` เพราะ port 3000 ถูก process อื่นใช้อยู่ — ถ้า `/login` ตอบ 404 บน 3000 ให้เปลี่ยน port แบบนี้)

---

## 6. หมายเหตุ / ข้อควรระวัง

- `pnpm seed:demo` **ลบทีม `demo-team` ทิ้งแล้วสร้างใหม่ทุกครั้ง** — อย่าใช้ slug นี้กับข้อมูลจริง
- ฟอนต์ที่ใช้ต้องรองรับภาษาไทย (Prompt/Kanit) — ฟอนต์จาก mockup (Sora/Inter/Fraunces) ใช้ได้เฉพาะตัวเลข/wordmark
- Capacity ตั้งสมมติฐาน 7 ชม./วัน และ 1 point = 1 ชม. (`src/lib/sprint/capacity.ts`)
- Next.js เตือน `middleware` → `proxy` (deprecated) ยังไม่ได้ migrate
- `e2e/demo-state.json` (มี invite token) ถูก gitignore
