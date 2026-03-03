# 📋 Project Summary

## Project Overview
- **Name:** KO-Stock-System (FoodStock Manager)
- **Type:** Restaurant / F&B Inventory Management
- **Tech Stack:** Google Apps Script (Code.gs) + Google Sheets + React (CDN) + Tailwind + Lucide

## Backend (GAS + Sheets)
- **Code.gs:** `doGet`, `getSystemData`, `saveTransaction`, `setupSheets`, `formatDate`, **`saveItem`**, **`saveBranch`**, **`saveSupplier`**, **`deleteSupplier`**
- **Sheets:** Items, Branches, Inventory, Transactions, **Suppliers** (FIFO lot-based)

## Frontend (Index.html)
- Single-page React app, Tailwind, Lucide icons, Babel
- **Tabs:** Dashboard, คลังสินค้า (FIFO/Lot), ตรวจนับสต็อกจริง, ประวัติเข้า-ออก, รายงาน, **รายการสินค้า**, **สาขา**, หน่วย, หมวดหมู่, **คู่ค้า**, **ต้นทุนอาหาร**
- **Features:** Multi-branch, In/Out/Transfer modals, Stock Take, FIFO deduction (client-side), **Items/Branches CRUD**

## Completed Features
- Dashboard with low-stock count, today's transactions count, inventory table
- Inventory detail (lot-based FIFO view)
- Stock take (ปรับยอดนับจริง) with variance → FIFO adjust
- Transaction history (Audit Log)
- In (bulk), Out, Transfer flows → save to Sheets via `saveTransaction`
- **Phase 1:** Items CRUD (add/edit/delete), Branches CRUD (add/edit/delete), Units CRUD, Categories CRUD; Mobile First UI (cards on mobile, table on desktop)
- **Phase 2:** History filters (date range, branch, item, type), Error handling (toast notifications, retry logic), UI polish
- **Phase 3:** Reports tab (สรุปประวัติ, สรุปสต็อกตามสาขา), Export CSV (ประวัติ filtered, สต็อก)
- **Phase 4:** ปุ่มรีเฟรช, First-run Setup (เริ่มต้นระบบจาก UI), Dashboard การ์ดลิงก์ไปคลัง/ประวัติ
- **Phase 5:** รายงานช่วงวันที่, ค้นหาสต็อก, ส่งออก CSV ประวัติจากรายงาน, ปุ่มพิมพ์ (History + Reports)
- **Phase 6:** กด Escape ปิด modal, ค้นหาในรายการสินค้า + สาขา
- **Phase 7:** ปุ่มล้างคำค้น (Items, Branches), ค้นหา + ล้าง ในหน่วย + หมวดหมู่
- **Phase 8:** จำสาขาที่เลือก (sessionStorage), Dashboard "วันนี้" ใช้ parseThaiDate + isToday
- **Phase 9:** จำ History filters (sessionStorage), แสดงเฉพาะใกล้หมด (Dashboard + Inventory), คลิกการ์ดเปิด filter
- **Phase 10:** จำ Report filters (sessionStorage), Loading skeleton แทน full-page spinner
- **Phase 11:** Deep link ?tab= (อ่าน/อัปเดต URL), ปุ่มคัดลอกสินค้า (Duplicate) ในรายการสินค้า
- **Phase 12:** แทน alert ด้วย showError ใน validation ฟอร์ม, ปุ่มคัดลอกสาขา (Duplicate) ในแท็บสาขา
- **Phase 13:** เรียงลำดับรายการสินค้า (ชื่อ, หมวดหมู่, ขั้นต่ำ), เรียงลำดับสาขา (ชื่อ, Stock Center ก่อน)
- **Phase 14:** จำการเรียง (sessionStorage), หน่วย/หมวดหมู่ เรียงตาม ชื่อ A–Z / Z–A
- **Phase 15:** จำแสดงเฉพาะใกล้หมด (sessionStorage), ประวัติ เรียงตาม วันที่ ล่าสุด/เก่าก่อน + จำการเรียง
- **Phase 16:** Dashboard + Inventory เรียงตาม ชื่อ / ยอดคงเหลือ / ใกล้หมดก่อน; จำ inventorySortBy
- **Phase 17:** Confirm Modal แทน confirm() (ลบ + ปรับยอดสต็อก); ปุ่มล้างคำค้น Dashboard
- **Phase 18:** ปุ่มคัดลอกหน่วย + หมวดหมู่ (Duplicate); openUnitModalAsCopy, openCategoryModalAsCopy
- **Phase 19:** รายงาน เรียงตาม ชื่อ/ยอดรวม/ใกล้หมดก่อน + ปุ่มล้างคำค้น; จำ reportSortBy

- **Plan (Suppliers+Pricing):** Phase 1 — Suppliers CRUD, แท็บคู่ค้า, รับสินค้าเลือกคู่ค้าจากระบบ. Phase 2 — ItemSuppliers, ซื้อได้ที่คู่ค้า + ชื่อที่คู่ค้า ในโมดัลแก้ไขสินค้า. Phase 3 — ราคาตอนนำเข้า: รับสินค้า กรอกราคา/หน่วย + แสดงยอดรวม, เก็บใน Inventory + Transactions. Phase 4 — WAC จากประวัตินำเข้า, แสดงต้นทุนเฉลี่ยในรายการสินค้า + รายงาน + CSV. Phase 5 — รายงานราคาซื้อ: กรองช่วงวันที่/สินค้า/คู่ค้า, ตาราง, ส่งออก CSV
- **UX Redesign (2026-02-01):** หน้าหลัก — Quick Actions 3 ปุ่มใหญ่, บัตรสรุปเข้าใจง่าย, Mobile cards. Modals นำเข้า/โอน — Search แทน dropdown, รายการคลิกเลือก. Stock Take — Search bar, Mobile cards, input ใหญ่. Mobile-first: viewport, font 16px ป้องกัน zoom
- **ต้นทุนอาหาร (2026-02-02):** แท็บ **ต้นทุนอาหาร** — รายการวัตถุดิบ (เลือกจากระบบดึงต้นทุนเฉลี่ย WAC หรือกรอกเอง), ต้นทุนแฝง (เปอร์เซ็นต์ของต้นทุนวัตถุดิบ / บาทต่อจาน), สรุปต้นทุนรวมต่อจาน, **ราคาขายแนะนำหน้าร้าน** (จากอัตราต้นทุนอาหารเป้าหมาย %), **ราคาแนะนำขายออนไลน์ (GP 30%)**
- **ต้นทุนอาหาร: เมนู (2026-02-02):** บันทึก/เลือก/แก้ไข/ลบ “เมนู” ได้ (เก็บใน Sheets: Menus, MenuIngredients, MenuOverheads)

## Current State
- Core + Master Data CRUD + History filters + Error handling + Reports & Export + UX & Setup + Phase 5–19 complete. Suppliers CRUD (Phase 1) done.
- Memory/architecture previously referred to Next.js/Supabase; actual project is GAS + Sheets.

## Key Files
- `Code.gs` – GAS backend
- `Index.html` – React frontend

---
*Last updated: 2026-03-03 (Synced with GitHub repository)*
