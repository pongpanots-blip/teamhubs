# วิธีส่ง docs เข้า IntrovertHubs (Context Engine)

เอกสารนี้อธิบายวิธีนำไฟล์ `.md` เข้าสู่ระบบ RAG ของ IntrovertHubs เพื่อให้
Context Engine ดึงไปใช้ตอน "Run context" / grill task — **ไม่เกี่ยวกับ MCP**
(MCP คือคนละเรื่อง ดูหัวข้อท้ายไฟล์)

## วิธีที่ 1: อัปโหลดผ่าน API (สำหรับทีมที่มี account ในระบบอยู่แล้ว)

```bash
curl -X POST "http://localhost:3000/api/docs?projectId=<PROJECT_ID>" \
  -H "Cookie: <session cookie จาก login>" \
  -F "files=@ชื่อไฟล์.md"
```

**ข้อจำกัด:**

- ต้อง login เป็น member ของทีมก่อน (`requireMembership`) — ไม่มี public/anonymous
  upload endpoint ใช้ session cookie เท่านั้น ไม่มี API token สำหรับ endpoint นี้
  (ต่างจาก `pluginToken` ที่ใช้กับ `/api/plugin/tasks` เท่านั้น และเป็น read-only)
- ต้องรู้ `projectId` ล่วงหน้า (ดูได้จาก URL ในแอปตอนเข้าโปรเจกต์ หรือ query
  `GET /api/projects`)
- role ต้องอยู่ใน `pm / ui / website / backend / mobile / ai`
- ไฟล์ต้องเป็น `.md` `.markdown` หรือ `.txt` เท่านั้น ไฟล์ละไม่เกิน 1MB
  สูงสุด 20 ไฟล์ต่อ request

**Port / URL:**

ไม่มี port fix ตายตัว — Next.js dev ใช้ default `3000` (ตาม
`BETTER_AUTH_URL="http://localhost:3000"` ใน `.env.example`) ถ้ารันด้วย
`pnpm dev` เฉย ๆ จะได้ `http://localhost:3000`

ถ้าเป็น production/staging ให้ใช้ domain จริงแทน `localhost:3000` (ดูค่า
`BETTER_AUTH_URL` ที่ตั้งไว้จริงบน environment นั้น)

## วิธีที่ 2: วางไฟล์ในโฟลเดอร์ repo แล้วรัน ingest (เร็วกว่า, ไม่ต้องผ่าน HTTP)

ถ้าทีมที่ส่ง docs มาเป็นคนนอกที่ไม่มี account ในระบบ ให้เขาส่งไฟล์ `.md`
มาตามแม่แบบ `docs/knowledge/_TEMPLATE.md` แล้วเราวางไฟล์ไว้ใน
`docs/knowledge/` เอง จากนั้นรัน:

```bash
pnpm docs:ingest <team-slug> [project-slug]
```

`project-slug` ไม่ใส่จะ default เป็น `general` — คำสั่งนี้เรียก
`importRepoDocsForTeam` ซึ่ง walk ไฟล์ `.md` ทั้งหมดใน `docs/**` ของ repo
แล้ว chunk + embed เข้า pgvector ให้อัตโนมัติ

**หมายเหตุ:** ลบไฟล์ `_TEMPLATE.md` ออกก่อน ingest จริง (ชื่อขึ้นต้น `_`
เพื่อกันสับสน แต่ยังเข้าเงื่อนไข `.md` อยู่ ระบบจะ ingest มันด้วยถ้าไม่ลบ)

## เขียนไฟล์ .md ยังไงให้ RAG ใช้ได้ดี

ดูแม่แบบเต็มที่ `docs/knowledge/_TEMPLATE.md` — สรุปสั้น ๆ:

- H1 เดียว = title ของเอกสาร (ระบบดึงไปโชว์เป็น title อัตโนมัติ)
- แบ่งเนื้อหาเป็นย่อหน้าสั้น ๆ ที่ "ยืนเดี่ยวได้" — ระบบ chunk ตามย่อหน้า
  (~1200 ตัวอักษร/chunk) แล้ว embed แยกกัน ถ้าย่อหน้าใดอ้างอิงย่อหน้าก่อน
  หน้ามากเกินไป ตอนดึงมาใช้เดี่ยว ๆ จะขาดบริบท
- หลีกเลี่ยง table/JSON ยาว ๆ เป็นก้อนเดียว แยกเป็น bullet/ย่อหน้าแทน

## MCP คือคนละเรื่อง

MCP (Model Context Protocol) จะช่วยให้ Claude/agent อื่นเรียกแอปนี้เป็น tool
ได้โดยตรง (เช่น `get_tasks`, `create_task`, `grill_task`) — คนละเรื่องกับการ
อัปโหลด docs เข้า RAG ในไฟล์นี้ ถ้าจะทำ MCP server แยกต่างหาก ให้เริ่มจาก
`@modelcontextprotocol/sdk` แล้วห่อ logic ที่มีอยู่แล้วใน `src/lib`
(tasks / sprints / projects / grill) เป็น MCP tools โดยใช้แนวคิด auth
เดียวกับ `pluginToken` (token ผูก 1 project ต่อ 1 token)
