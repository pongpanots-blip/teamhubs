# คู่มือการทำ Sprint: วางแผน คุมงาน และวิเคราะห์

> เอกสารสรุปแนวทางการวางแผน Sprint การควบคุมงานระหว่างทาง
> และเมตริกที่ต้องเก็บในระดับการ์ด สำหรับทีมที่กำลังสร้างระบบ Task Management เอง

---

## สารบัญ
1. [Sprint คืออะไร และวงจรการทำงาน](#1-sprint-คืออะไร-และวงจรการทำงาน)
2. [Sprint Planning: วางแผนอย่างไรให้ไม่พัง](#2-sprint-planning-วางแผนอย่างไรให้ไม่พัง)
3. [การคุมงานระหว่าง Sprint](#3-การคุมงานระหว่าง-sprint)
4. [Analytics: เมตริกระดับการ์ดและระดับทีม](#4-analytics-เมตริกระดับการ์ดและระดับทีม)
5. [การนำไปใช้ในระบบจริง (Data Model)](#5-การนำไปใช้ในระบบจริง-data-model)
6. [Checklist สรุป](#6-checklist-สรุป)

---

## 1. Sprint คืออะไร และวงจรการทำงาน

**Sprint** คือกล่องเวลาตายตัว (time-box) ที่ทีมตกลงกันว่าจะส่งมอบสิ่งที่ใช้งานได้จริงออกมา
- ความยาวมาตรฐาน: **1–4 สัปดาห์** (นิยมที่สุดคือ 2 สัปดาห์)
- Sprint จบแล้วเริ่ม Sprint ถัดไปทันที ไม่มีช่วงพัก
- ความยาวต้องคงที่ เพื่อให้ตัวเลขเปรียบเทียบข้าม Sprint ได้

### พิธีกรรมประจำ Sprint (Scrum Events)

| พิธีกรรม | เมื่อไหร่ | เวลา (Sprint 2 สัปดาห์) | วัตถุประสงค์ |
| :--- | :--- | :--- | :--- |
| Backlog Refinement | กลาง Sprint ก่อนหน้า | 1–2 ชม. | เกลา ticket ให้พร้อมก่อนถึงคิว |
| Sprint Planning | วันแรก | ≤ 4 ชม. | เลือกงาน + ตั้ง Sprint Goal |
| Daily Standup | ทุกวัน | 15 นาที | ซิงก์งาน + เปิดเผย blocker |
| Sprint Review | วันสุดท้าย | 1–2 ชม. | สาธิตผลงานให้ stakeholder |
| Retrospective | หลัง Review | 1–1.5 ชม. | ปรับปรุงกระบวนการทำงาน |

---

## 2. Sprint Planning: วางแผนอย่างไรให้ไม่พัง

### 2.1 ตั้ง Sprint Goal ก่อนเลือกงานเสมอ

ข้อผิดพลาดที่พบบ่อยที่สุดคือ **หยิบ ticket มากองก่อน แล้วค่อยหาเป้าหมายทีหลัง** ซึ่งเป็นลำดับที่กลับหัว

ลำดับที่ถูกต้อง:
1. ตอบให้ได้ว่า "Sprint นี้จบแล้ว ผู้ใช้ทำอะไรได้เพิ่ม"
2. เลือกเฉพาะการ์ดที่พาไปถึงเป้าหมายนั้น
3. งานที่ไม่เกี่ยวกับ Goal ให้พิจารณาเป็นลำดับรอง

### 2.2 คำนวณ Capacity จริง

Velocity ในอดีตใช้ **พยากรณ์ระยะยาว** ได้ แต่การคอมมิตของ Sprint ปัจจุบันต้องคิดจากคนที่มีอยู่จริง
ทั้งวันลา คนใหม่ที่เพิ่ง onboard และงาน support ที่แทรกเข้ามา

```text
Capacity = Σ (จำนวนคน × วันทำงานจริง × ชั่วโมงต่อวัน × Focus Factor)

Focus Factor ≈ 0.6 – 0.8
(ส่วนที่หายไปคือ ประชุม, code review, งานแทรก, การสลับบริบท)
```

**ตัวอย่างการคำนวณ**

```text
Developer 4 คน × 9 วัน × 6 ชม. × 0.7  ≈ 151 ชม.
กันสำรองสำหรับงานด่วน/บั๊ก 15–20%     ≈ 26 ชม.
------------------------------------------------
Capacity ที่คอมมิตได้จริง              ≈ 125 ชม.
```

### 2.3 การประมาณขนาดงาน (Estimation)

**Story Points**
- ใช้สเกล Fibonacci: `1, 2, 3, 5, 8, 13`
- วัด **ความพยายาม + ความซับซ้อน + ความไม่แน่นอน** รวมกัน ไม่ใช่จำนวนชั่วโมง
- **เปรียบเทียบข้ามทีมไม่ได้** เพราะแต่ละทีมกำหนดสเกลอ้างอิงของตัวเอง
- **กฎสำคัญ:** งานที่ประเมินได้ 13 ขึ้นไป = ใหญ่เกินไป ต้องซอยย่อย มิฉะนั้นจะค้างข้าม Sprint

**Planning Poker**
- ทุกคนโหวตพร้อมกันเพื่อเลี่ยงอคติจากคนพูดก่อน
- ถ้าผลต่างกันมาก (เช่น 1 กับ 8) ให้หยุดคุยว่าทำไม
- จุดที่เห็นไม่ตรงกันมักคือจุดที่ requirement ยังไม่ชัด

**ทางเลือกที่ง่ายกว่า: Right-sizing**
- ซอยทุกใบให้มีขนาดใกล้เคียงกัน (~1–2 วัน) แล้วนับจำนวนใบ (Throughput)
- ความแม่นยำในการพยากรณ์ใกล้เคียงกับ Story Points แต่ถกเถียงกันน้อยกว่ามาก

### 2.4 Definition of Ready / Definition of Done

**Definition of Ready (DoR)** — เกณฑ์ก่อนการ์ดเข้า Sprint
- มี Acceptance Criteria ชัดเจน
- ประเมินขนาดแล้ว
- ไม่มี dependency ที่ยังค้างอยู่
- มี design / mockup พร้อม (ถ้าเป็นงาน UI)

**Definition of Done (DoD)** — เกณฑ์ก่อนปิดการ์ด
- โค้ดผ่าน Code Review
- มี test ครอบคลุมตามมาตรฐานทีม
- Deploy ขึ้น staging แล้ว
- อัปเดตเอกสารเรียบร้อย
- Product Owner ตรวจรับแล้ว

> **สำคัญมาก:** ต้องเขียน DoD ให้ชัดตั้งแต่วันแรก
> ถ้านิยามคำว่า "เสร็จ" ของแต่ละคนไม่ตรงกัน ตัวเลขทุกอย่างจะเชื่อถือไม่ได้

---

## 3. การคุมงานระหว่าง Sprint

### 3.1 Daily Standup ที่มีประสิทธิภาพ
- ถามที่ **การ์ด** ไม่ใช่ถามที่ **คน**
- เดินบอร์ดจาก **ขวาไปซ้าย** (จากงานที่ใกล้ Done ที่สุดก่อน) เพื่อผลักงานให้จบ ไม่ใช่เริ่มงานใหม่
- โฟกัสที่ blocker และการ์ดที่ค้างนานผิดปกติ

### 3.2 WIP Limit (Work In Progress)
- ตั้งเพดานจำนวนงานต่อคอลัมน์ เช่น `In Progress ≤ 2 ต่อคน`
- การลด WIP คือวิธีลด Cycle Time ที่ได้ผลที่สุด
- **ลด WIP ก่อนเสมอ** อย่าเพิ่งไปเร่งให้คนทำงานเร็วขึ้น

### 3.3 การจัดการ Blocker
- การ์ดที่ติดต้องมี **ธงแดง + เหตุผล + ผู้รับผิดชอบปลดล็อก**
- ต้องบันทึกระยะเวลาที่ถูกบล็อกไว้ด้วย เพื่อแยกปัญหาภายนอกออกจากประสิทธิภาพทีม

### 3.4 การป้องกัน Scope Creep
- ห้ามเพิ่มงานกลาง Sprint โดยไม่มีการแลกเปลี่ยน
- ถ้าจำเป็นจริง ต้อง **นำงานเดิมออกแลก** ด้วยแต้มที่เท่ากัน
- บันทึกทุกการเปลี่ยนแปลง scope เพื่อให้เห็นในกราฟ Burndown

### 3.5 Sprint Goal ต้องไม่เปลี่ยน
- ถ้าเป้าหมายใช้ไม่ได้แล้วจริงๆ ให้ **ยกเลิก Sprint** ไปเลย
- ดีกว่าลากงานที่ไร้ความหมายไปจนจบรอบ

---

## 4. Analytics: เมตริกระดับการ์ดและระดับทีม

### 4.1 เมตริกระดับการ์ด (Card-level Metrics)

| เมตริก | นิยาม | ใช้ตัดสินใจเรื่องอะไร |
| :--- | :--- | :--- |
| **Lead Time** | ตั้งแต่สร้างการ์ด → Done | ลูกค้ารอนานแค่ไหน (มุมมองภายนอก) |
| **Cycle Time** | ตั้งแต่เริ่มลงมือ → Done | ทีมทำงานเร็วแค่ไหน (มุมมองภายใน) |
| **Time in Status** | ระยะเวลาที่อยู่ในแต่ละคอลัมน์ | หาคอขวด เช่น ค้างที่ Review 3 วัน = ปัญหาอยู่ที่ reviewer |
| **Blocked Time** | เวลารวมที่ติดธงแดง | แยกปัญหาภายนอกออกจากฝีมือทีม |
| **Flow Efficiency** | `เวลาทำงานจริง ÷ Cycle Time × 100` | ทีมทั่วไปได้เพียง **15–40%** ที่เหลือคือเวลารอ |
| **Age (WIP Age)** | เริ่มมาแล้วกี่วัน โดยยังไม่จบ | **ตัวชี้วัดสำคัญที่สุดแบบ realtime** เตือนได้ก่อนงานจะสาย |
| **Rework / Bounce Count** | จำนวนครั้งที่ถอยกลับ status | บ่งชี้ requirement ไม่ชัด หรือปัญหาคุณภาพโค้ด |
| **Estimate vs Actual** | แต้มที่ประเมิน เทียบกับเวลาจริง | ปรับปรุงความแม่นยำในการประเมิน |

#### เทคนิค: Service Level Expectation (SLE)

นำ Cycle Time ย้อนหลังมาหาค่า percentile แล้วตั้งเป็นข้อตกลงระดับบริการ

```text
ตัวอย่าง: "85% ของงานเสร็จภายใน 6 วัน"

→ ถ้าการ์ดใดมี Age แตะ 6 วันแล้วยังไม่จบ
  = ระบบแจ้งเตือนอัตโนมัติทันที ไม่ต้องรอถึง Daily Standup
```

### 4.2 เมตริกระดับ Sprint และระดับทีม

| กราฟ | วิธีอ่าน |
| :--- | :--- |
| **Burndown Chart** | เส้นราบ = ติด blocker · ดิ่งวูบช่วงท้าย = ทำงานเป็นก้อนไม่ไหลต่อเนื่อง · **เส้นวิ่งขึ้น = scope creep** |
| **Velocity Chart** | ใช้ค่าเฉลี่ย 3–5 Sprint ล่าสุด · ห้ามเทียบข้ามทีม · ห้ามใช้เป็น KPI ประเมินบุคคล |
| **Cumulative Flow Diagram (CFD)** | แถบสีที่หนาขึ้นเรื่อยๆ = คิวสะสมตรงจุดนั้น · แถบกว้าง = WIP สูง · ความสูงแนวตั้ง ≈ Cycle Time เฉลี่ย |
| **Cycle Time Scatter Plot** | จุดกระจายรายใบ + เส้น percentile 50/85/95 · เห็น outlier ชัดกว่าค่าเฉลี่ยมาก |
| **Throughput Run Chart** | จำนวนงานที่เสร็จต่อสัปดาห์ · ใช้ทำ Monte Carlo Simulation เพื่อพยากรณ์ได้ |

### 4.3 กับดักที่ต้องหลีกเลี่ยง

> **อย่านำ Velocity ไปวัดผลงานรายบุคคล**
> ทีมจะตอบสนองด้วยการเป่าแต้มให้เฟ้อ (point inflation)
> และตัวเลขจะไร้ความหมายทันที
>
> ให้วัดที่ **ความคาดเดาได้ (Predictability)** — ทำได้ใกล้เคียงกับที่คอมมิตไว้หรือไม่
> แทนที่จะวัดความเร็ว

---

## 5. การนำไปใช้ในระบบจริง (Data Model)

เมตริกทั้งหมดข้างต้นคำนวณได้จาก **ตาราง log การเปลี่ยนสถานะ** เพียงชุดเดียว

### 5.1 Schema

```sql
-- แกนหลัก: ทุกเมตริกคำนวณจากตารางนี้
CREATE TABLE task_status_history (
  id              BIGSERIAL PRIMARY KEY,
  task_id         BIGINT NOT NULL,
  from_status     TEXT,
  to_status       TEXT NOT NULL,
  status_category TEXT NOT NULL,  -- backlog | active | waiting | done
  changed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  changed_by      BIGINT
);

-- บันทึกช่วงเวลาที่ถูกบล็อก
CREATE TABLE task_blocked_periods (
  id           BIGSERIAL PRIMARY KEY,
  task_id      BIGINT NOT NULL,
  blocked_at   TIMESTAMPTZ NOT NULL,
  unblocked_at TIMESTAMPTZ,
  reason       TEXT
);

-- ข้อมูล Sprint
CREATE TABLE sprint (
  id                BIGSERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  goal              TEXT,
  start_at          TIMESTAMPTZ NOT NULL,
  end_at            TIMESTAMPTZ NOT NULL,
  committed_points  NUMERIC  -- แช่ค่าไว้ตอนเริ่ม ห้ามคำนวณย้อนหลัง
);

-- ติดตามการเปลี่ยนแปลง scope กลาง Sprint
CREATE TABLE sprint_scope_change (
  id         BIGSERIAL PRIMARY KEY,
  sprint_id  BIGINT NOT NULL,
  task_id    BIGINT NOT NULL,
  action     TEXT NOT NULL,  -- added | removed
  points     NUMERIC,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Snapshot รายวันสำหรับ CFD (เร็วกว่าคำนวณสด)
CREATE TABLE flow_snapshot (
  snapshot_date DATE NOT NULL,
  project_id    BIGINT NOT NULL,
  status        TEXT NOT NULL,
  task_count    INT NOT NULL,
  PRIMARY KEY (snapshot_date, project_id, status)
);
```

### 5.2 วิธีคำนวณแต่ละเมตริก

| เมตริก | วิธีคำนวณ |
| :--- | :--- |
| **Cycle Time** | `MIN(changed_at) WHERE category='active'` → `MAX(changed_at) WHERE category='done'` |
| **Lead Time** | `task.created_at` → `MAX(changed_at) WHERE category='done'` |
| **Time in Status** | ผลต่างระหว่างแถวที่ติดกันใน `task_status_history` (ใช้ `LEAD()` window function) |
| **Blocked Time** | `SUM(unblocked_at - blocked_at)` จาก `task_blocked_periods` |
| **Flow Efficiency** | `(Cycle Time − Waiting Time − Blocked Time) ÷ Cycle Time` |
| **WIP Age** | `now() − MIN(changed_at) WHERE category='active'` (เฉพาะงานที่ยังไม่ done) |
| **CFD** | นับจำนวน task ต่อ status ต่อวัน เก็บลง `flow_snapshot` ด้วย daily job |
| **Burndown** | แต้มคงเหลือรายวัน + แยกเส้น scope ออกมาต่างหาก |
| **Rework Count** | นับแถวที่ `to_status` ถอยกลับไปยัง status ที่ลำดับต่ำกว่า `from_status` |

### 5.3 ข้อควรระวังในการ implement
- เก็บ `committed_points` ตอนเริ่ม Sprint แล้ว **แช่ค่าไว้** ห้ามคำนวณย้อนหลังจากสถานะปัจจุบัน มิฉะนั้นจะมองไม่เห็น scope creep
- ทำ index ที่ `(task_id, changed_at)` ตั้งแต่แรก เพราะ query ส่วนใหญ่จะ group by task
- แยก `status_category` ออกจาก `status` เพื่อให้ผู้ใช้เปลี่ยนชื่อคอลัมน์ได้โดยไม่ทำให้เมตริกพัง
- ใช้ business hours ในการคำนวณเวลา หากทีมไม่ทำงานเสาร์-อาทิตย์

---

## 6. Checklist สรุป

### ก่อนเริ่ม Sprint
- [ ] Backlog ผ่าน Refinement แล้ว
- [ ] ทุกการ์ดที่จะเข้าผ่านเกณฑ์ DoR
- [ ] คำนวณ Capacity จากคนที่มีอยู่จริง
- [ ] ตั้ง Sprint Goal ก่อนเลือกการ์ด
- [ ] กันสำรอง 15–20% สำหรับงานแทรก
- [ ] บันทึก `committed_points` ไว้

### ระหว่าง Sprint
- [ ] Daily Standup เดินบอร์ดจากขวาไปซ้าย
- [ ] เช็คการ์ดที่ WIP Age เกิน SLE ทุกวัน
- [ ] บังคับใช้ WIP Limit
- [ ] ติดธง Blocker พร้อมผู้รับผิดชอบ
- [ ] ทุกการเปลี่ยน scope ต้องมีการแลกเปลี่ยน

### หลังจบ Sprint
- [ ] Review: สาธิตของจริง ไม่ใช่ slide
- [ ] ตรวจ Burndown หา scope creep
- [ ] ดู Scatter Plot หา outlier แล้วถามว่าทำไม
- [ ] อัปเดต SLE จากข้อมูลล่าสุด
- [ ] Retrospective: เลือกปรับปรุงแค่ 1–2 เรื่องต่อรอบ

---

## แหล่งอ้างอิง

- [teachingagile — Sprint Planning](https://teachingagile.com/scrum/psm-1/scrum-framework/scrum-events/sprint-planning)
- [teachingagile — Velocity Metrics](https://teachingagile.com/scrum/psm-1/scrum-implementation/scrum-metrics-reporting/velocity)
- [luckiwi — Scrum Velocity](https://www.luckiwi.com/en/blog/article/scrum-velocity)
- [agileseekers — Lead Time vs Cycle Time](https://agileseekers.com/blog/lead-time-vs-cycle-time-how-to-measure-improve-in-kanban)
- [businessmap — Kanban Analytics](https://businessmap.io/kanban-resources/kanban-analytics)
- [monday — Agile Metrics](https://monday.com/blog/rnd/agile-metrics/)