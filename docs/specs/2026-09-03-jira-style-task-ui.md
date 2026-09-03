# Jira-Style Task UI — Feature Spec

> สรุปสำหรับ dev: อ้างอิงแพทเทิร์น UI/UX ของ Jira มาปรับใช้กับ Task module ที่มีอยู่แล้วใน repo นี้ (`src/app/app/[projectSlug]/tasks`, `src/components/tasks/*`, `src/components/sprints/*`)

## บริบท (สถานะปัจจุบันในโค้ด)

โปรเจกต์นี้มี Task/Sprint infrastructure อยู่แล้ว:
- Board: [tasks-board.tsx](src/components/tasks/tasks-board.tsx)
- Sprint: [sprint-status-board.tsx](src/components/sprints/sprint-status-board.tsx), [sprint-card.tsx](src/components/sprints/sprint-card.tsx), [backlog-panel.tsx](src/components/sprints/backlog-panel.tsx)
- Task creation: [quick-task-form.tsx](src/components/tasks/quick-task-form.tsx), [quick-task-dialog.tsx](src/components/tasks/quick-task-dialog.tsx), [new-task-tabs.tsx](src/components/tasks/new-task-tabs.tsx)
- Sub-tasks: [add-subtask-form.tsx](src/components/tasks/add-subtask-form.tsx)
- Ticket keys (เช่น `CHK-142`): [task-key.ts](src/lib/tasks/task-key.ts), migration `20260903093000_task_ticket_keys`
- Status history: migration `20260831160000_task_status_history`
- Man-hours: migration `20260831200000_task_man_hours`
- มี design doc เดิมอยู่แล้ว: [2026-08-30-task-detail-redesign-design.md](docs/superpowers/specs/2026-08-30-task-detail-redesign-design.md)

งาน spec นี้ระบุสิ่งที่ **ต้องทำ (action items)** โดยอ้างอิง pattern ของ Jira ที่ verify แล้ว (ดู "แหล่งอ้างอิง" ท้ายไฟล์) — ของที่มี infra รองรับแล้ว (migration/lib) ให้ต่อ UI ให้ครบ, ของที่ยังไม่มีเลยให้สร้างใหม่

## Layout convention ที่ต้องทำตาม (จาก Jira Issue View)

- **Left (main content)**: title, description, activity/comment feed — เนื้อหาหลักของงาน
- **Right (context panel)**: status, assignee, priority, labels/component, sprint, due date — metadata ที่ต้อง scan ได้เร็ว
- **Top-right (issue actions)**: transition status, assign to me, more actions (⋯)
- กฎสำคัญ: **ห้าม render panel ที่ว่างเปล่า** — ถ้า section ไม่มีข้อมูล (เช่น ไม่มี sub-task, ไม่มี attachment) ให้ซ่อน section นั้นไปเลย ไม่ใช่โชว์ empty state ค้างไว้

## สิ่งที่ต้องทำ (แบ่งตาม priority)

### P0 — ต้องทำ: ต่อ UI ให้ครบตาม infra ที่มีอยู่แล้ว
- [ ] เพิ่ม/ยืนยัน issue type selector: Task, Bug, Sub-task ใน [new-task-tabs.tsx](src/components/tasks/new-task-tabs.tsx) / [quick-task-form.tsx](src/components/tasks/quick-task-form.tsx)
- [ ] ทำ drag-and-drop เปลี่ยน status บน [tasks-board.tsx](src/components/tasks/tasks-board.tsx) ให้ครบทุก column
- [ ] แยก sprint board ออกจาก backlog ให้ชัดใน [sprint-status-board.tsx](src/components/sprints/sprint-status-board.tsx) + [backlog-panel.tsx](src/components/sprints/backlog-panel.tsx)
- [ ] จัด layout task detail panel ตาม Jira convention ด้านบน (left = title/description/activity, right = status/assignee/priority/labels/sprint)
- [ ] เพิ่ม sub-task list เข้าไปใน task detail panel (ใช้ [add-subtask-form.tsx](src/components/tasks/add-subtask-form.tsx) ที่มีอยู่)
- [ ] ต่อ UI แสดง status history / activity log จาก migration `20260831160000_task_status_history` ให้ครบในหน้า detail

### P1 — ต้องสร้างใหม่ (ยังไม่มีใน repo)
- [ ] สร้าง Table/List view เพิ่มจาก Kanban (sort/filter ตาม column, ไว้ scan งานจำนวนมาก)
- [ ] สร้าง Calendar view ผูกกับ due date / sprint dates — ต้องเพิ่ม field due-date ก่อนถ้ายังไม่มี
- [ ] เพิ่ม quick actions บน task card (assign, change status) โดยไม่ต้องเปิด detail panel
- [ ] ทำ inline edit ใน detail panel (คลิกแล้วแก้ได้ทันที ไม่ต้องกด edit mode แยก)
- [ ] เพิ่ม filter/search bar เหนือ board (by assignee, priority, label, sprint)

### P2 — ทำเมื่อจำเป็นจริง (อย่า over-build ถ้ายังไม่มี use case)
- [ ] Real-time board updates (SSE/WebSocket) — ทำเมื่อมีหลายคนทำงานพร้อมกันบน board เดียวจริง
- [ ] Bulk actions (multi-select แล้ว move/assign พร้อมกัน)
- [ ] Custom fields ต่อ project

## Data model — สิ่งที่ต้องต่อ UI vs สิ่งที่ต้องสร้าง schema ใหม่

| field | ทำอะไรต่อ | migration/ที่มา |
|---|---|---|
| ticket key (`PROJ-123`) | ต่อ UI ให้แสดงครบทุกที่ที่อ้างถึง task | `20260903093000_task_ticket_keys` |
| sub-tasks | ต่อ UI เข้า task detail (ดู P0) | `20260831140000_task_sub_tasks` |
| status history | ต่อ UI แสดง activity log (ดู P0) | `20260831160000_task_status_history` |
| man-hours / estimate | ต่อ UI ให้ input/แสดงผลในฟอร์ม | `20260831200000_task_man_hours` |
| sprint | ต่อ UI แยก board (ดู P0) | `20260831170000_sprint` |
| readiness / decision log | ต่อ UI แสดงใน task detail | `20260830090000_task_readiness_and_decision_log` |
| handoff doc | ต่อ UI action button | `20260830150000_add_task_handoff` |
| calendar due-date | **ต้องสร้าง schema ใหม่** (field + migration) ก่อนทำ P1 calendar view | ยังไม่มี |

## แหล่งอ้างอิง (verify แล้วจาก deep-research)

- Jira issue view layout (left/right split, action zones): [Atlassian dev docs — issue-view](https://developer.atlassian.com/cloud/jira/platform/issue-view/), [issue-view-ui-locations](https://developer.atlassian.com/cloud/jira/software/issue-view-ui-locations/)
- Issue types (Epic/Story/Task/Bug/Sub-task): [Atlassian community guide](https://community.atlassian.com/forums/App-Central-articles/Jira-Issue-Types-A-Complete-Guide-for-2026/ba-p/2928042)
- Kanban/scrum board + multi-view เป็น core UX strength: [Createbytes review](https://createbytes.com/insights/jira-atlassian-ui-ux-yay-or-nay-review), open-source clones ([evanch98/jira-clone-nextjs](https://github.com/evanch98/jira-clone-nextjs), [LeeYoonSam/jira-clone](https://github.com/LeeYoonSam/jira-clone))

**หมายเหตุ**: ข้อมูลบาง claim ที่หาเจอ (Jira hierarchy แบบ Initiative>Epic>Story, รายละเอียด repo clone บางตัว) ถูก refute ใน adversarial verification — ไม่ได้เอามาใส่ในสเปกนี้ อย่าเชื่อโดยไม่เช็คของจริง
