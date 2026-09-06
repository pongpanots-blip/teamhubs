# IntrovertHubs — Design Brief สำหรับทีม UI (Figma)

## 1. โปรเจกต์คืออะไร

เว็บแอปสำหรับทีมเล็ก (PM + UI + Dev) ที่ช่วยจัดการ task โดยมี AI ช่วยประเมิน "ความพร้อม" ของงานแต่ละชิ้น

Flow หลัก: PM สร้าง task → ระบบดึง context จากเอกสาร/GitHub/Figma → ส่งให้ Claude สรุปเป็นข้อมูลโครงสร้าง → Engine (กติกาตายตัว ไม่ใช่ AI) ตัดสิน readiness score / status / dependency ของ task นั้น

จุดสำคัญ: **Claude แค่วิเคราะห์ ไม่ได้ตัดสิน** — status/readiness เป็นผลจาก Engine เท่านั้น เวลาออกแบบ UI ที่โชว์ผลจาก AI ควรแยกให้ชัดว่า "นี่คือสรุปจาก AI" กับ "นี่คือ status ที่ระบบตัดสิน"

Role ในระบบ: **PM · UI · Backend · Mobile · AI** (PM มองเห็นทุกอย่าง, role อื่นเห็นเฉพาะงานตัวเอง + งานที่ block ตัวเอง)

---

## 2. หน้าจอที่มีอยู่ (ต้องออกแบบใหม่ให้เป็นระบบ)

| หน้า | Route | สถานะปัจจุบัน |
|---|---|---|
| Login / Register / Invite | `/login`, `/register`, `/invite/[token]` | มี แต่พื้นฐาน |
| Onboarding | `/onboarding` | สร้าง/เข้าทีมครั้งแรก |
| Overview (cross-project) | `/app` | งานของฉันข้าม project ทั้งหมด + การ์ด project แต่ละอัน |
| Project Home | `/app/[projectSlug]` | 3 ส่วน: My Work, Attention (ต้องรีบดู), Team |
| Task list | `/app/[projectSlug]/tasks` | รายการ task ของ project |
| **Task detail** | `/app/[projectSlug]/tasks/[id]` | หน้าที่ซับซ้อนที่สุด (ดูหัวข้อ 3) |
| Docs | `/app/[projectSlug]/docs` | ingest เอกสารเข้า RAG |
| Project / Team settings | `/app/[projectSlug]/settings`, `/app/team/settings` | จัดการสมาชิก, invite |

Component library ปัจจุบัน: **shadcn/ui + Tailwind** (Card, Badge, Button พื้นฐาน) — ยังไม่มี design system ที่วางไว้เป็นระบบ นี่คือโอกาสให้ UI ทีมตั้งกติกาใหม่ทั้งหมด

---

## 3. หน้าที่ควรโฟกัสก่อน: Task Detail

หน้านี้ยาวและมีข้อมูลเยอะที่สุด ควรออกแบบให้เป็นระบบ ไม่ใช่ Card เรียงต่อกันเฉยๆ เนื้อหาที่ต้องโชว์:

- **Header**: ชื่อ task, ปุ่ม "Run context" (เรียก AI วิเคราะห์ใหม่)
- **Key facts**: Owner, Priority (Critical/High/Medium/Low), Deadline, Status badge
  - Status: `NOT_READY` `READY` `ASSIGNED` `WORKING` `BLOCKED` `REVIEW` `DONE` (7 สถานะ ต้องมี color coding ที่แยกกันชัด โดยเฉพาะ BLOCKED ต้องเด่นสุด)
- **Missing context panel**: รายการสิ่งที่ยังขาด (requirement/rules/AC ไม่ครบ) พร้อมคำถามที่ AI generate ให้ PM ตอบ — ควรเป็น UI แบบ checklist/todo ที่ตอบแล้วหายไป
- **Readiness bar**: progress bar 0-100%
- **Requirement, Business rules, Sub-tasks, Dependencies**: เนื้อหาแบบ text/list
- **Design section**: สถานะ Figma (🟢 Ready for Dev / ⚪ Not ready) + ลิงก์เปิด Figma file/page/frame — **นี่คือจุดเชื่อมกับปลั๊กอิน Figma ที่มีอยู่แล้ว** ควรออกแบบให้เด่น เพราะเป็นจุดที่ UI role ใช้บ่อย
- **AI advisory panel**: สรุปจาก Claude (context summary, questions for PM, missing context/conflicts) แยกฝั่งกับ "Engine decision" (status + readiness + blocked-by) — ต้องแยก visual ชัดเจนว่าอันไหนคือ AI พูด อันไหนคือระบบตัดสิน
- **Decision log**: ฟอร์ม + ประวัติการตัดสินใจ (ใครตัดสินอะไร เมื่อไหร่)
- **Handoff docs / Completion docs**: เอกสารส่งงานที่ generate อัตโนมัติ, โหลดได้, อัปโหลดเอกสารส่งงานได้
- **Recent context runs**: log ดิบ (JSON) — อาจไม่ต้องโชว์เต็มใน Figma mockup แต่ต้องเผื่อที่ไว้

---

## 4. หน้า Home / Overview

โครงสร้างเป็น 3 โซนซ้ำกันทั้งใน Overview (ข้าม project) และ Project Home:

1. **My Work** — งานของฉัน (PM เห็นทั้งหมด, role อื่นเห็นแค่ของตัวเอง)
2. **Attention** — จำนวนงานที่ blocked / missing context / UI ready-for-dev (เป็น badge สรุป ไม่ใช่ list)
3. **Team** — สมาชิกในทีม + งานที่แต่ละคนถืออยู่

ที่ระดับ Overview จะมีการ์อด "Project" แสดง badge สรุปของแต่ละ project (blocked count, missing context count, ready-for-dev count) — เป็นจุดที่ PM ใช้ตัดสินใจว่าจะเข้า project ไหนก่อน ควรออกแบบให้ scan ได้เร็ว

---

## 5. สิ่งที่อยากได้จาก UI ทีม (Figma)

1. **Design tokens**: สี (โดยเฉพาะ status/priority color system ที่ใช้ซ้ำทั่วแอป), typography scale, spacing — ให้ตรงกับ shadcn/ui ที่ใช้อยู่หรือ mapping ใหม่
2. **Component library**: Status badge, Priority badge, Readiness bar, Task card (list), Attention summary card, Missing-context checklist item
3. **Screen mockups** เรียงตามลำดับความสำคัญ:
   - Task Detail (ซับซ้อนสุด, โฟกัสก่อน)
   - Task List
   - Project Home / Overview
   - Login/Onboarding (เรียบง่าย ทำทีหลังได้)
4. **Empty/edge states**: "No projects yet", "No decisions yet", "No Figma linked yet" ฯลฯ — มีอยู่แล้วในโค้ดแบบ text เฉยๆ อยากให้มี state ที่ดีขึ้น

---

## 6. หมายเหตุทางเทคนิค (สำหรับ handoff กลับมาเป็นโค้ด)

- โปรเจกต์นี้มี **Figma plugin อยู่แล้ว** (`figma-plugin/`) ที่คุยกับ API เพื่อ mark task ว่า "Ready for Dev" พร้อม path ของ file/page/frame — เวลาออกแบบหน้า Figma เอง ให้คำนึงว่าโครงสร้าง page/frame naming จะถูกอ่านโดยปลั๊กอินนี้ด้วย
- ภาษา UI ปัจจุบันผสม EN (label ปุ่ม/สถานะ) + TH (คำถามที่ AI generate ให้ PM) — ให้ตัดสินใจสม่ำเสมอว่า UI หลักใช้ EN หรือ TH เป็นหลัก
