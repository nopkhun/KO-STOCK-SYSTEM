# แผนแก้ Bug และฟีเจอร์ (จาก User Feedback)

## สรุปรายการ

| # | รายการ | สถานะ | หมายเหตุ |
|---|--------|--------|----------|
| 1 | การเลือกร้านหายไปในการแสดงผลแบบ Desktop | done | เพิ่มดรอปดาวน์เลือกสาขาใน header (md+) |
| 2 | เพิ่มเมนูค้นหารายการในหน้า Stock (ตรวจนับสต็อกจริง) | done | มีช่องค้นหาอยู่แล้ว (stockTakeSearchTerm) |
| 3 | Bug filter เลือกดูตามรายชื่อร้าน ข้อมูลไม่ขึ้น | done | แก้ให้เทียบ branch name จาก branchId |
| 4 | โอนสต็อค: user อื่นที่ต้นทางไม่เห็นสต็อกอัปเดต | done | รีเฟรชทุก 30s + เมื่อกลับมาเปิดแท็บ |
| 5 | กดเปลี่ยนหน้าข้อมูลไม่อัปเดต | done | รีเฟรชเมื่อ visibility + polling |
| 6 | อยากให้ข้อมูลอัปเดตตรงกันทุก user | done | polling 30s + on focus |
| 7 | ต้นทุนอาหาร บันทึกเมนูไม่ได้ | done | เพิ่ม menus/menuIngredients/menuOverheads ใน getSystemData |

---

## 1. การเลือกร้านบน Desktop

- **สาเหตุ:** บล็อก "เลือกสาขาที่กำลังทำงาน" อยู่ใน sidebar ล่าง อาจถูกตัดหรือไม่เด่นบน Desktop
- **แก้:** ใน header บริเวณ Desktop (md ขึ้นไป) แสดงแถบ "กำลังทำงานที่ [ชื่อสาขา]" และปุ่ม/ดรอปดาวน์เปลี่ยนสาขา (คลิกแล้วเปิดรายการสาขา หรือเปิด sidebar ชั่วคราว)

## 2. ค้นหารายการในหน้า Stock (ตรวจนับสต็อกจริง)

- **ทำ:** ในแท็บ `stocktake` เพิ่ม input ค้นหาชื่อสินค้า (filter รายการที่แสดงตามชื่อ)

## 3. Filter ประวัติตามร้าน — ข้อมูลไม่ขึ้น

- **สาเหตุ:** `historyFilters.branchId` เก็บ **id** ของสาขา แต่ใน `transactions` คอลัมน์ fromBranch/toBranch เป็น **ชื่อสาขา**
- **แก้:** ตอน filter ใช้ `branchId` หา `branch.name` จาก `branchesMaster` แล้ว filter โดยเทียบ `tx.fromBranch === branch.name || tx.toBranch === branch.name`

## 4–6. อัปเดตข้อมูลข้าม user / เปลี่ยนแท็บ

- **ข้อจำกัด:** Google Apps Script ไม่มี WebSocket
- **แนวทาง:**
  - **Polling:** เรียก `loadData()` ทุก N วินาที (เช่น 30s) เมื่อแอปอยู่ foreground
  - **On focus:** เมื่อผู้ใช้กลับมาเปิดแท็บ/หน้าต่าง (visibility change) ให้รีเฟรชข้อมูล
  - **On tab change:** เมื่อเปลี่ยนไปแท็บ dashboard / inventory / stocktake / history ให้รีเฟรชข้อมูล (หรือเฉพาะเมื่อไม่เคยโหลดใน session นั้น)

## 7. ต้นทุนอาหาร — บันทึกเมนูไม่ได้

- **สาเหตุ:** เราเอา Menus / MenuIngredients / MenuOverheads ออกจาก `getSystemData` เพื่อให้โหลดได้เหมือน backup ดังนั้นฝั่ง client ไม่ได้รายการเมนู และการบันทึกอาจไม่โหลดกลับ
- **แก้:** ใน `Code.gs` เพิ่มการอ่านชีต Menus, MenuIngredients, MenuOverheads กลับใน `getSystemData` แบบปลอดภัย (ถ้าไม่มีชีตให้คืน `[]`) และ return ใน object; ฝั่ง Index ใช้ `data.menus` / `data.menuIngredients` / `data.menuOverheads` ตามเดิม

---

*อัปเดต: 2026-02-02*
