# AI Architecture — Claude + RAG + Deterministic Engine

TeamHub ใช้ **Claude API + RAG + Deterministic Context Engine**

Claude **ไม่ใช่** สมองทั้งหมด

## Flow

```
PM Requirement
      ↓
Context Engine
      ↓
ค้น Internal Docs
      ↓
RAG (top-k snippets only)
      ↓
Relevant Context
      ↓
Claude API
      ↓
Structured JSON
      ↓
Validation (Zod — strip forbidden fields)
      ↓
Deterministic Engine
      ↓
Readiness / Dependency / Status
      ↓
App persists to DB
```

## Claude ทำ

- อ่าน Requirement ภาษาคน
- Extract Business Rules (candidates)
- หา Missing Context
- วิเคราะห์ Conflict
- สรุป Context
- Generate คำถามให้ PM
- วิเคราะห์เอกสารที่เกี่ยวข้อง (จาก RAG snippets)

## Claude ไม่ทำ

- ไม่ตัดสิน Business Rule เอง (final)
- ไม่เปลี่ยน Status เอง
- ไม่คำนวณ Readiness เอง
- ไม่เขียน DB โดยตรง
- ไม่ส่ง Internal Docs ทั้งหมดเข้า Prompt

## Deterministic Engine ทำ

- คำนวณ Readiness score จากกฎคงที่
- ตั้ง Status (รวมกฎ Assigned ≠ Working)
- Resolve dependency IDs จาก hints ของ Claude
- Persist ผ่าน application code เท่านั้น
