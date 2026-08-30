# IntrovertHubs Requirements

## Problems to solve

- ไม่รู้ว่าใครเป็น Owner
- ไม่รู้ว่าใครกำลังทำอะไร
- Requirement อยู่ในหัว PM
- Business Rule ไม่ครบ
- UI → PM → Dev ต้องถามกัน
- Dev ต้องถามว่า API มีหรือยัง
- Dev ไม่รู้ว่า Figma อันไหนพร้อมใช้
- Dependency ไม่ชัด
- WFH แล้ว knowledge ไม่เท่ากัน
- ทุกคนคิดว่า Dev B ทำ แต่จริง ๆ ไม่มีใครทำ (**Assigned ≠ Working**)
- ข้อมูลอยู่ใน Internal Docs แต่คนไม่รู้ว่าต้องไปหาไหน

## Dynamic requirement (no fixed form)

PM พิมพ์ข้อความอิสระ เช่น:

> อยากให้ลูกค้าใช้ coupon ลด 10% แต่ใช้ได้ครั้งเดียว และไม่ให้ลดเกิน 500

IntrovertHubs แปลงเป็น `BusinessRules[]`:

```json
[
  { "key": "discount", "label": "Discount", "value": "10%", "unit": "%" },
  { "key": "usage", "label": "Usage", "value": "1 time / customer" },
  { "key": "maximum_discount", "label": "Maximum Discount", "value": "500", "unit": "THB" }
]
```

กฎแต่ละ task ไม่เหมือนกันได้ (Minimum Order, Product Category, Buy X Get Y, …)
โดยเก็บเป็น JSON array — **ห้าม** hardcode คอลัมน์ `coupon_discount` / `coupon_expiry` ใน schema

## Task must have

| Field | Purpose |
|-------|---------|
| Owner | ใครรับผิดชอบ |
| Priority | ความสำคัญ |
| Deadline | กำหนดส่ง |
| Requirement | สิ่งที่ต้องทำ (ไม่อยู่ในหัว PM) |
| BusinessRules[] | กติกาธุรกิจแบบ dynamic |
| Dependencies | สิ่งที่ต้องเสร็จก่อน (รวม API readiness) |
| Figma | ลิงก์ดีไซน์ + พร้อมใช้หรือยัง |
| GitHub | Issue / PR |
| Internal Docs | ชี้ไปที่เอกสารที่เกี่ยวข้อง |
| Decision Log | บันทึกการตัดสินใจ |
| Status | สถานะงาน |
| Readiness | คะแนนพร้อมเริ่มจาก Deterministic Engine |

## Status

`NOT_READY` · `READY` · `ASSIGNED` · `WORKING` · `BLOCKED` · `REVIEW` · `DONE`

### Assigned ≠ Working

- **ASSIGNED** = มี Owner แต่ยังไม่เริ่มทำ
- **WORKING** = กำลังทำจริง
- การมี Owner อย่างเดียวห้ามตีความเป็น WORKING
