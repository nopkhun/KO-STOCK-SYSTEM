# 📦 Component Registry

> KO-Stock-System – React SPA in Index.html

---

## 📄 Pages / Views (Tab-based)

| Tab | Key | Description |
|-----|-----|-------------|
| Dashboard | `dashboard` | Quick Actions 3 ปุ่ม (นำเข้า, โอน, นับสต็อก); Stats cards; inventory table/cards + search |
| คลังสินค้า | `inventory` | Lot-based FIFO cards per item |
| ตรวจนับสต็อกจริง | `stocktake` | Mobile-first: hero + step hint; Search with label + touch clear; Table (desktop) / Cards (mobile) with "จำนวนนับจริง" label; input min-h-56px, inputMode decimal; empty state + ล้างคำค้น; sticky submit |
| ประวัติเข้า-ออก | `history` | Audit log table (Transactions) |
| รายการสินค้า | `items` | Items CRUD: list (table/cards), add, edit |
| สาขา | `branches` | Branches CRUD: list (table/cards), add, edit |
| ต้นทุนอาหาร | `costcalc` | คำนวณต้นทุนวัตถุดิบ + ต้นทุนแฝง + ราคาขายแนะนำ (หน้าร้าน/ออนไลน์ GP 30%) + บันทึกเป็นเมนู/แก้ไขได้ |

---

## 🧩 UI Blocks (inline in Index.html)

| Block | Description |
|-------|-------------|
| Sidebar | Logo, nav tabs (incl. รายการสินค้า, สาขา, ต้นทุนอาหาร), branch selector. **Mobile:** drawer (hamburger open, overlay close, goTab/goBranch close). |
| Mobile branch bar | Sticky bar (md:hidden): hamburger + "กำลังทำงานที่ [สาขา]" — tap opens drawer. |
| Header | Branch/tab title; actions (hidden on items/branches) |
| Modals | **In (นำเข้า):** step hint, search + 44px clear, product list min-h-48px, คู่ค้า/วันหมดอายุ/จำนวน/หน่วย/ราคา border+inputMode decimal, ปุ่มเพิ่ม mobile full-width, bulk list empty state, submit disabled when no items. Out, Transfer (Search สินค้า/สาขา). **Item add/edit**; **Branch add/edit** |
| Stats cards | สินค้าใกล้หมด, รายการเคลื่อนไหววันนี้ |
| Tables | Dashboard, Stock take, History, Items, Branches (desktop); cards on mobile for Items, Branches |

---

## 📊 State

- `itemsMaster`, `branchesMaster`, `stock`, `transactions` (from GAS)
- `activeBranch`, `activeTab`, `searchTerm`, `stockTakeSearchTerm`, `stockTakeValues`, `showModal`, `modalType`, `modalItemSearch`, `modalBranchSearch`, `bulkItems`, `form`
- `itemForm`, `branchForm`, `showItemModal`, `showBranchModal`, `editingItem`, `editingBranch`

---
*Last updated: 2026-02-01*
