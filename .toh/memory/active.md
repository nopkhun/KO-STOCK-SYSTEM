# 🔥 Active Task

## Current Focus
ระบบพร้อมใช้งาน — ตรวจสอบ logic สต็อกเสร็จแล้ว แก้ไข 3 bugs

## In Progress
- (none)

## Just Completed (2026-03-03)
- **/toh-fix (audit):** ตรวจสอบ logic ทั้งหมดของ saveTransaction, updateTransaction, FIFO, Transfer, StockTake — core logic ถูกต้อง พบ bugs: (1) `updateTransaction 'out'` อ่าน Inventory sheet ทีละแถว → แก้เป็น `getDataRange()` ครั้งเดียว ลด timeout risk (2) `updateTransaction 'in'` ทำ expiryDate หาย → แก้ให้คืน expiryDate เดิม (3) `performStockTakeSubmit` note ไม่บอก +/- → แก้ note ชัดเจน (4) Lock timeout 5s→10s ทั้งสอง functions

## Blockers / Issues
- (none)

- **/toh-fix:** หลังเข้าสู่ระบบขึ้น "ยังไม่ได้ตั้งค่าระบบ" ทั้งที่ข้อมูลใน Google Sheet ครบ — แก้โดย (1) ใช้สถานะชีตเป็นหลัก: setupCompleteBySheets = setupStatus.Units.rows > 1 && setupStatus.Categories.rows > 1 (2) แสดงหน้า setup เฉพาะเมื่อ needSetup && !setupCompleteBySheets (3) เมื่อ getSetupStatus คืนค่าและชีตมีข้อมูล ให้เรียก refetchData() เพื่อโหลดหน่วย/หมวดหมู่จริง
- **/toh-fix:** สาขาที่เลือกไม่คงหลังนำเข้า/โอน/เบิก/ปรับสต็อก — แก้โดยให้ refetchData/handleRefresh/setupSheets success ใช้ sessionStorage (BRANCH_STORAGE_KEY) เป็นหลักในการคงสาขา แทน activeBranch จาก closure ที่ stale จาก setInterval/visibility
- **/toh-design:** นำเข้าสินค้า (Import modal) — Mobile-first, user-friendly: step hint ใน header, search + clear 44px touch, product rows min-h-48px, คู่ค้า/วันหมดอายุ/จำนวน/หน่วย/ราคา border + focus ring, inputMode decimal, ปุ่มเพิ่ม full-width on mobile + transition, bulk list empty state ชัดเจน, ปุ่มยืนยัน disabled เมื่อไม่มีรายการ + transition-colors
- **/toh-design:** ตรวจนับสต็อกจริง — Mobile-first polish (hero + step hint, search label + touch clear, cards with จำนวนนับจริง label, input 56px + inputMode decimal, empty state + ล้างคำค้น, sticky submit)
- **/toh-test:** Unit tests (tests/logic.test.js) 9/9 ผ่าน; คู่มือทดสอบด้วยมือ tests/MANUAL-TEST-PLAN.md (นำเข้า/โอน/เบิก/นับสต็อก/Dashboard)
- **Plan (toh-plan):** สร้าง development-plan-ux-and-master.md — Phase 1–4 (Success+Redirect, เหตุผลเบิก, หน้า Master มูลค่า, แก้ไขประวัติ 1 ชม.); (1) เบิกของ (นำออก) สำหรับ “นำของที่นำเข้าผิดออก” และ (2) ตรวจนับสต็อกจริง (ปรับยอด) สำหรับ “ให้ยอดตรงของจริง”

## Next Steps
- Phase 1–4 done (Success UI, เหตุผลเบิก, หน้า Master มูลค่า, แก้ไขประวัติ 1 ชม.)

## Blockers / Issues
- (none)

## Just Completed (2026-03-03) — ยกเลิกระบบแคช + ย้อนกลับก่อน 1 มี.ค.
- **/toh-plan:** ยกเลิกระบบแคชทั้งหมด และย้อนกลับการแก้ไขต้นมีนาคม — ลบ MASTER_CACHE_KEY, อ่าน/เขียน/ลบ cache, ลบ loadTimeoutRef, refetchedEmptyRef, setupCompleteBySheets/showSetupScreen, การ refetch หลัง save; โหลดข้อมูลจาก GAS เท่านั้นทุกครั้ง

## Just Fixed (2026-03-03)
- **/toh-fix:** หลังล็อกอินขึ้น "ยังไม่ได้ตั้งค่าระบบ" แม้ชีตมีข้อมูล — แก้โดย (1) ใช้ cache ข้าม loadData เฉพาะเมื่อ cache มี units และ categories ไม่ว่าง (2) เมื่อ getSetupStatus แสดงว่า Units/Categories มีแถวข้อมูล ให้เรียก refetchData() เพื่อโหลดข้อมูลจริง
- **/toh-fix:** แดชบอร์ด "ไม่พบรายการ" — (1) เมื่อใช้ cache ให้ setInventoryLoaded(true) (2) เมื่อ itemsMaster ว่างหลังโหลดแล้ว ให้ refetchData() อีกครั้ง (ครั้งเดียวต่อ session)
- **/toh-fix:** รอโหลดแล้วหยุดโหลด → เลือกสาขาไม่ได้/ไม่พบรายการ — (1) โหลดได้แต่ branches ว่าง (มี units/categories) ถือว่าไม่สมบูรณ์ → แสดงหน้า "โหลดข้อมูลไม่สำเร็จ" + ลองใหม่ (2) timeout 28 วินาที ฝั่ง client กันค้างโหลด

---
*Last updated: 2026-02-07*
