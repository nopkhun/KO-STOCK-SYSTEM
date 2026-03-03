# 🔥 Active Task

## Current Focus
ปรับปรุงหน้า "บัญชีสต็อก" (value-report tab) ใน Index.html

## In Progress
- (none)

## Just Completed (2026-03-03)
- **ปรับปรุงหน้าบัญชีสต็อก (value-report):** เพิ่ม logic และ UI ใหม่ทั้งหมด:
  1. **KPI Cards (4 ใบ):** มูลค่าสต็อกคงเหลือ (gradient สีเขียว hero), ซื้อเดือนนี้, ของเสียสะสม + % ของยอดซื้อ, ต้นทุนเฉลี่ย/วัน
  2. **Tab switcher 3 view:**
     - "มูลค่าแยกรายสินค้า" — ตารางแสดงสินค้าทุกรายการ จำนวนคงเหลือ มูลค่า และ progress bar %
     - "มูลค่าแยกสาขา" — ตารางแสดงมูลค่าสต็อกแต่ละสาขา + จำนวนรายการ
     - "ประวัติการซื้อรายวัน" — ตารางการซื้อรายวัน + % และ tfoot รวม
  3. เพิ่ม useMemo: `valueReportByItem`, `valueReportByBranch`, `valueReportThisMonthPurchase`, `valueReportTotalPurchase`, `valueReportFilteredItems`
  4. เพิ่ม state: `valueReportSearch`, `valueReportActiveView`
  5. แก้ปัญหาเดิม: "มูลค่ารวมสต็อก" และ "มูลค่าคงเหลือ" ซ้ำกัน → ตัดออก เปลี่ยนเป็น card ที่มี context ชัดเจน
- **/toh-fix (audit):** ตรวจสอบ logic ทั้งหมดของ saveTransaction, updateTransaction, FIFO, Transfer, StockTake — core logic ถูกต้อง พบ bugs: (1) `updateTransaction 'out'` อ่าน Inventory sheet ทีละแถว → แก้เป็น `getDataRange()` ครั้งเดียว ลด timeout risk (2) `updateTransaction 'in'` ทำ expiryDate หาย → แก้ให้คืน expiryDate เดิม (3) `performStockTakeSubmit` note ไม่บอก +/- → แก้ note ชัดเจน (4) Lock timeout 5s→10s ทั้งสอง functions
- **/toh-fix:** หลังเข้าสู่ระบบขึ้น "ยังไม่ได้ตั้งค่าระบบ" ทั้งที่ข้อมูลใน Google Sheet ครบ — แก้โดย (1) ใช้สถานะชีตเป็นหลัก: setupCompleteBySheets = setupStatus.Units.rows > 1 && setupStatus.Categories.rows > 1 (2) แสดงหน้า setup เฉพาะเมื่อ needSetup && !setupCompleteBySheets (3) เมื่อ getSetupStatus คืนค่าและชีตมีข้อมูล ให้เรียก refetchData() เพื่อโหลดหน่วย/หมวดหมู่จริง
- **/toh-fix:** สาขาที่เลือกไม่คงหลังนำเข้า/โอน/เบิก/ปรับสต็อก — แก้โดยให้ refetchData/handleRefresh/setupSheets success ใช้ sessionStorage (BRANCH_STORAGE_KEY) เป็นหลักในการคงสาขา แทน activeBranch จาก closure ที่ stale จาก setInterval/visibility
- **/toh-design:** นำเข้าสินค้า (Import modal) — Mobile-first, user-friendly: step hint ใน header, search + clear 44px touch, product rows min-h-48px, คู่ค้า/วันหมดอายุ/จำนวน/หน่วย/ราคา border + focus ring, inputMode decimal, ปุ่มเพิ่ม full-width on mobile + transition, bulk list empty state ชัดเจน, ปุ่มยืนยัน disabled เมื่อไม่มีรายการ + transition-colors
- **/toh-design:** ตรวจนับสต็อกจริง — Mobile-first polish (hero + step hint, search label + touch clear, cards with จำนวนนับจริง label, input 56px + inputMode decimal, empty state + ล้างคำค้น, sticky submit)
- **/toh-test:** Unit tests (tests/logic.test.js) 9/9 ผ่าน; คู่มือทดสอบด้วยมือ tests/MANUAL-TEST-PLAN.md (นำเข้า/โอน/เบิก/นับสต็อก/Dashboard)
- **Plan (toh-plan):** สร้าง development-plan-ux-and-master.md — Phase 1–4 (Success+Redirect, เหตุผลเบิก, หน้า Master มูลค่า, แก้ไขประวัติ 1 ชม.); (1) เบิกของ (นำออก) สำหรับ "นำของที่นำเข้าผิดออก" และ (2) ตรวจนับสต็อกจริง (ปรับยอด) สำหรับ "ให้ยอดตรงของจริง"

## Blockers / Issues
- (none)

## Next Steps
- Phase 1–4 done (Success UI, เหตุผลเบิก, หน้า Master มูลค่า, แก้ไขประวัติ 1 ชม.)

---
*Last updated: 2026-03-03*
