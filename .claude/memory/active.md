# 🔥 Active Task

## Current Focus
ปรับปรุงหน้า "บัญชีสต็อก" (value-report tab) ใน Index.html

## In Progress
- (none)

## Just Completed
- **ปรับปรุงหน้าบัญชีสต็อก (value-report):** เพิ่ม logic และ UI ใหม่ทั้งหมด:
  1. **KPI Cards (4 ใบ):** มูลค่าสต็อกคงเหลือ (gradient สีเขียว hero), ซื้อเดือนนี้, ของเสียสะสม + % ของยอดซื้อ, ต้นทุนเฉลี่ย/วัน
  2. **Tab switcher 3 view:**
     - "มูลค่าแยกรายสินค้า" — ตารางแสดงสินค้าทุกรายการ จำนวนคงเหลือ มูลค่า และ progress bar %
     - "มูลค่าแยกสาขา" — ตารางแสดงมูลค่าสต็อกแต่ละสาขา + จำนวนรายการ
     - "ประวัติการซื้อรายวัน" — ตารางการซื้อรายวัน + % และ tfoot รวม
  3. เพิ่ม useMemo: `valueReportByItem`, `valueReportByBranch`, `valueReportThisMonthPurchase`, `valueReportTotalPurchase`, `valueReportFilteredItems`
  4. เพิ่ม state: `valueReportSearch`, `valueReportActiveView`
  5. แก้ปัญหาเดิม: "มูลค่ารวมสต็อก" และ "มูลค่าคงเหลือ" ซ้ำกัน → ตัดออก เปลี่ยนเป็น card ที่มี context ชัดเจน

## Next Steps
- (none)

## Blockers / Issues
- (none)

---
*Last updated: 2026-03-03*
