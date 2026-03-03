# 🏗️ Project Architecture

> KO-Stock-System (FoodStock) – GAS + Google Sheets + React SPA

---

## 📁 Entry Points

| Type | Path | Purpose |
|------|------|---------|
| Web App | `Code.gs` → `doGet()` | Serves `Index.html` as Web App |
| Frontend | `Index.html` | Single React SPA (Tailwind, Lucide, Babel) |

---

## 🗂️ Core Modules

### Backend (Code.gs)

| Function | Purpose |
|----------|---------|
| `doGet()` | Create HTML from `Index`, set title, XFrame, viewport |
| `getSystemData()` | Read Items, Branches, Inventory, Transactions from Sheets → JSON |
| `saveTransaction(payload)` | Append Transactions, update Inventory (FIFO), LockService |
| `saveMenu(payload)` | Upsert เมนู + เขียน MenuIngredients/MenuOverheads (แทนที่ชุดเดิมของเมนูนั้น) |
| `deleteMenu(menuId, token)` | ลบเมนู + ลบรายการวัตถุดิบ/ต้นทุนแฝงของเมนูนั้น |
| `setupSheets()` | Create Items, Branches, Inventory, Transactions + headers |
| `formatDate(date)` | `yyyy-MM-dd` |

### Google Sheets Schema

| Sheet | Columns |
|-------|---------|
| Items | id, name, unit, minStock, category |
| Branches | id, name, isHQ |
| Inventory | branchId, itemId, lotId, receivedDate, expiryDate, supplier, remainingQty |
| Transactions | id, timestamp, fromBranch, toBranch, itemName, type, amount, unit, note, supplier |
| Menus | id, name, note, targetFoodCostPercent, createdAt, updatedAt |
| MenuIngredients | menuId, type, itemId, itemName, unit, unitPriceManual, qty |
| MenuOverheads | menuId, label, type, value |

### Frontend (Index.html)

| Section | Description |
|---------|-------------|
| App | Tabs: dashboard, inventory, stocktake, history; branch selector; modals In/Out/Transfer |
| Data | `itemsMaster`, `branchesMaster`, `stock`, `transactions` from `getSystemData` |
| FIFO | `calculateFIFODeduction` (client); server updates via `inventoryUpdates` |

---

## 🔄 Data Flow

1. **Load:** `google.script.run.getSystemData()` → set state → render.
2. **Save:** User action → build `txData` + `inventoryUpdates` → `google.script.run.saveTransaction(payload)` → update state on success.

---

## 📝 Notes

- No Next.js, no Supabase. Stack: GAS + Sheets + React (CDN).
- UI First still applies when adding new screens (e.g. Items/Branches management).

---
*Last updated: 2026-01-27*
