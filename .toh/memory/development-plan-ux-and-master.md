# แผนพัฒนาตามความต้องการ 4 ข้อ (Success UI, แก้ไขประวัติ, หน้ามูลค่า Master, เหตุผลเบิก)

**วันที่:** 2026-02-02  
**ที่มา:** /toh-plan จากผู้ใช้

---

## สรุป 4 ข้อ

| # | ความต้องการ | วิธีดำเนินการหลัก |
|---|----------------|-------------------|
| 1 | หลังกดนำเข้า/เบิกของ → แสดง "บันทึกข้อมูลสำเร็จ" + redirect ไปหน้าประวัติเข้า-ออก | เปลี่ยนข้อความ toast + หลัง success เรียก refetch แล้ว setActiveTab('history') |
| 2 | แก้ไขประวัตินำเข้า/เบิกของ ได้เฉพาะของตัวเอง ภายใน 1 ชม. | เพิ่มปุ่ม "แก้ไข" ในประวัติ (เงื่อนไข: performedBy === ตัวเอง, ภายใน 1 ชม.) + Backend updateTransaction (reverse inventory แล้ว apply ใหม่) |
| 3 | หน้าเฉพาะ Master: มูลค่ารวมสต็อก, การซื้อแต่ละวัน, มูลค่าของเสีย, มูลค่าคงเหลือ | แท็บใหม่ (เช่น "บัญชีสต็อก/รายงานมูลค่า") แสดงเฉพาะ role master, คำนวณจาก Transactions + Inventory |
| 4 | เบิกของ: เลือกเหตุผลเพิ่ม (เช่น ของเสีย) เพื่อเก็บแสดงมูลค่าที่เสียไป | เพิ่มฟิลด์ "เหตุผลเบิก" (เบิกใช้ / ของเสีย / อื่นๆ) + คำนวณต้นทุนจาก FIFO เก็บ outValue ใน Transactions |

---

## Phase 1: Success UI + Redirect ไปหน้าประวัติ (ข้อ 1)

**เป้าหมาย:** หลังบันทึกรายการนำเข้า หรือ เบิกของ/โอน สำเร็จ → แสดงข้อความ "บันทึกข้อมูลสำเร็จ" และพาไปที่แท็บ "ประวัติเข้า-ออก" เพื่อให้ผู้ใช้เห็นรายการที่เพิ่งบันทึก

### Tasks

| ลำดับ | Task | ไฟล์/ส่วนที่เกี่ยวข้อง | Agent |
|-------|------|------------------------|--------|
| 1.1 | เปลี่ยนข้อความ toast หลังบันทึก modal นำเข้า/เบิก/โอน จาก "ดำเนินการสำเร็จ" เป็น "บันทึกข้อมูลสำเร็จ" | Index.html — `handleFinalSubmit` withSuccessHandler | Dev |
| 1.2 | หลัง success: เรียก refetchData (หรือใช้ state ที่อัปเดตแล้ว) แล้ว setActiveTab('history') เพื่อให้เห็นประวัติล่าสุด | Index.html — withSuccessHandler หลัง setTransactions/setStock | Dev |

### รายละเอียดเทคนิค

- ตำแหน่ง: ใน `google.script.run.saveTransaction(...).withSuccessHandler((res) => { ... })` ของ modal นำเข้า/โอน/เบิก
- ปัจจุบัน: `showToast('ดำเนินการสำเร็จ');` และปิด modal ไม่ได้ไปที่ history
- แก้เป็น: `showToast('บันทึกข้อมูลสำเร็จ');` และเพิ่ม `setActiveTab('history');` หลังอัปเดต state (และถ้าต้องการให้ข้อมูลตรงกับ server ให้เรียก refetchData ก่อนแล้วใน onDone ค่อย setActiveTab('history'))

---

## Phase 2: เหตุผลเบิก + มูลค่าของเสีย (ข้อ 4) — ทำก่อนข้อ 3 เพราะข้อ 3 ใช้ outReason/outValue

**เป้าหมาย:** ใน modal "เบิกของ" ให้เลือกเหตุผลเพิ่ม (เช่น เบิกใช้ / ของเสีย / อื่นๆ) และเมื่อเลือก "ของเสีย" (หรือทุกกรณี) ระบบคำนวณมูลค่าตามต้นทุน FIFO เก็บใน Transactions เพื่อใช้แสดง "มูลค่าที่เสียไป" ในข้อ 3

### Tasks

| ลำดับ | Task | ไฟล์/ส่วนที่เกี่ยวข้อง | Agent |
|-------|------|------------------------|--------|
| 2.1 | ขยาย `calculateFIFODeduction` ให้คืนค่า `deductedValue` (sum ของจำนวนที่ตัด × unitPrice ของแต่ละ lot) | Index.html | Dev |
| 2.2 | ใน form state ของ modal: เพิ่มฟิลด์ `outReason` (ค่าเริ่มต้นเช่น "เบิกใช้") | Index.html — form, openModal | Dev |
| 2.3 | ใน modal เบิกของ (modalType === 'out'): เพิ่ม dropdown "เหตุผลเบิก" ตัวเลือก เช่น เบิกใช้, ของเสีย, อื่นๆ | Index.html — Modal เบิก | UI + Dev |
| 2.4 | ตอน handleFinalSubmit กรณี out: ใช้ deductedValue จาก FIFO ส่งใน newTxList (outValue) และ outReason ไป saveTransaction | Index.html | Dev |
| 2.5 | Backend: Transactions sheet เพิ่มคอลัมน์ outReason, outValue (ถ้ายังไม่มี); saveTransaction เขียนค่าสองฟิลด์นี้เมื่อ type === 'out' | Code.gs, setupSheets/ensureColumns | Backend |
| 2.6 | getSystemData: อ่านและส่ง outReason, outValue ในแต่ละแถว Transactions | Code.gs | Backend |

---

## Phase 3: หน้า Master — มูลค่ารวมสต็อก, ซื้อแต่ละวัน, ของเสีย, มูลค่าคงเหลือ (ข้อ 3)

**เป้าหมาย:** เพิ่มหน้า (แท็บ) เฉพาะสิทธิ Master แสดงภาพรวมด้านการเงินคลัง: มูลค่ารวมสต็อก, การซื้อของในแต่ละวัน (รายจ่าย), มูลค่าของที่เสียไป, มูลค่าคงเหลือ (คล้ายบัญชีรายจ่ายและมูลค่าคงเหลือ)

### Tasks

| ลำดับ | Task | ไฟล์/ส่วนที่เกี่ยวข้อง | Agent |
|-------|------|------------------------|--------|
| 3.1 | เพิ่มแท็บใหม่ (เช่น "บัญชีสต็อก" หรือ "รายงานมูลค่า") ในเมนู — แสดงเฉพาะเมื่อ user.role === 'master' | Index.html — VALID_TABS, Sidebar, เงื่อนไขแสดง | UI |
| 3.2 | สร้างหน้าคอนเทนต์: การ์ด/บล็อก (1) มูลค่ารวมสต็อก = sum(Inventory remainingQty × unitPrice หรือ WAC ตามที่กำหนด), (2) การซื้อในแต่ละวัน = group by วันที่ จาก Transactions type 'in' sum(totalPrice), (3) มูลค่าของเสีย = sum(Transactions type 'out' ที่ outReason === 'ของเสีย' ของ outValue), (4) มูลค่าคงเหลือ = อาจใช้ค่าเดียวกับ (1) หรือแยกตามสาขา | Index.html — หน้าใหม่, useMemo คำนวณจาก stock + transactions | Dev |
| 3.3 | ออกแบบ UI: ตัวเลขชัดเจน มีหน่วย "บาท" อาจมีตารางรายวันสำหรับ "การซื้อแต่ละวัน" และสรุปของเสีย | Index.html | UI/Design |

---

## Phase 4: แก้ไขประวัตินำเข้า/เบิกของ (ของตัวเอง ภายใน 1 ชม.) — ข้อ 2

**เป้าหมาย:** ผู้ใช้สามารถแก้ไขรายการนำเข้า หรือ เบิกของ ที่ตัวเองทำได้ ภายใน 1 ชั่วโมง (จาก timestamp ของรายการ) เพื่อแก้กรณีใส่ข้อมูลผิด โดยไม่ต้องกดเบิกออก/นำเข้าใหม่ให้สับสน

### Tasks

| ลำดับ | Task | ไฟล์/ส่วนที่เกี่ยวข้อง | Agent |
|-------|------|------------------------|--------|
| 4.1 | ในหน้าประวัติ: สำหรับแต่ละแถวที่ type เป็น 'in' หรือ 'out' และ performedBy === user.username และ timestamp ภายใน 1 ชม. แสดงปุ่ม "แก้ไข" | Index.html — ตารางประวัติ, ฟังก์ชันเช็คเวลา (parseThaiDate, diff ≤ 1 ชม.) | Dev |
| 4.2 | กด "แก้ไข" → เปิด modal (หรือหน้า) แก้ไข: แสดงฟิลด์ที่แก้ได้ (อย่างน้อย จำนวน, หมายเหตุ; ถ้าเป็น in อาจมี supplier, ราคา ฯลฯ ตามที่ backend รองรับ) | Index.html — Edit Tx Modal | UI + Dev |
| 4.3 | Backend: เพิ่มฟังก์ชัน updateTransaction(token, { txId, ...payload }) — ตรวจสอบ performedBy ตรงกับ user และ timestamp ภายใน 1 ชม. → โหลดแถว Transactions ที่ id = txId → Reverse ผลต่อ Inventory (กรณี in: ลดจำนวนตาม amount เดิมจากสาขา/สินค้านั้น; กรณี out: เพิ่มกลับเป็น lot ตาม amount เดิม และถ้ามี outValue ใช้เป็น unitPrice ของ lot ที่เพิ่มกลับ) → Apply รายการใหม่ (in: เพิ่ม lot; out: FIFO ลด + คำนวณ outValue ใหม่) → อัปเดตแถว Transactions ด้วย payload ใหม่ | Code.gs | Backend |
| 4.4 | Frontend: กดบันทึกใน modal แก้ไข → เรียก updateTransaction → on success refetchData + ปิด modal + showToast | Index.html | Dev |

### หมายเหตุ

- การ "reverse" ใน Backend ต้องใช้ itemId จาก itemName (map กับ Items) และ branchId จาก fromBranch (map กับ Branches) เพราะแถว Transactions ปัจจุบันอาจไม่มีคอลัมน์ itemId/branchId — หรือพิจารณาเพิ่มคอลัมน์ itemId ใน Transactions ตอนบันทึกเพื่อให้แก้ไขง่ายขึ้น
- ภายใน 1 ชม.: ใช้ timestamp ของรายการ (ถ้าเป็นรูปแบบไทย เช่น dd/mm/yyyy hh:mm:ss ต้อง parse ให้ได้ Date) เปรียบกับเวลาปัจจุบัน

---

## ลำดับการทำที่แนะนำ

1. **Phase 1** — เร็วและไม่พึ่งฟีเจอร์อื่น (Success UI + Redirect)
2. **Phase 2** — เหตุผลเบิก + outReason/outValue (รองรับ Phase 3 และรายงานของเสีย)
3. **Phase 3** — หน้า Master มูลค่า (ใช้ outReason/outValue จาก Phase 2)
4. **Phase 4** — แก้ไขประวัติ (ซับซ้อนที่สุด ต้อง reverse + apply ใหม่ และเงื่อนไขเวลา/เจ้าของ)

---

## สรุปการเปลี่ยนแปลงข้อมูล/Backend

| รายการ | การเปลี่ยนแปลง |
|--------|-----------------|
| Transactions | เพิ่มคอลัมน์ outReason, outValue (สำหรับ type 'out') |
| Code.gs | saveTransaction เขียน outReason, outValue; getSystemData ส่งออกมา; ฟังก์ชันใหม่ updateTransaction |
| Index.html | Form เบิกมี outReason; calculateFIFODeduction คืน deductedValue; Success handler + redirect; แท็บ Master + หน้าคำนวณมูลค่า; ปุ่มแก้ไข + modal แก้ไข + เรียก updateTransaction |

---

*แผนนี้พร้อมสำหรับการนำไปดำเนินการทีละ Phase ตามลำดับด้านบน*
