# 📋 Project Summary

## Project Overview
| รายการ | รายละเอียด |
|--------|------------|
| **ชื่อ** | KO-Stock-System (ระบบคลังวัตถุดิบร้านอาหาร) |
| **ประเภท** | Food/Restaurant Inventory Management |
| **Tech Stack** | Next.js 16, React 19, Tailwind v4, shadcn/ui, Zustand, Supabase |
| **การย้ายระบบ** | จาก Google Apps Script + Google Sheets |
| **งบประมาณ** | 0 บาท/เดือน (free tier ทั้งหมด) |

## Completed Features

### Phase 1: Foundation ✅
- Next.js 16 + TypeScript strict
- Supabase schema (13 ตาราง, RLS, triggers, seeds)
- TypeScript types สำหรับทุก entity
- Utilities: cn, formatters, FIFO, debounce
- Supabase clients (browser + server)
- Auth middleware
- Zustand stores (auth, master-data, inventory, ui)
- shadcn/ui components (button, input, card, dialog, select, badge, skeleton, label, textarea, toast)
- App layout พร้อม Thai lang, Providers wrapper
- Tailwind v4 theme (orange primary)

### Phase 2: Feature Parity ✅
**Auth:**
- Login page (email/password + Supabase auth)
- Change password page

**Dashboard:**
- Summary cards, low stock alerts, recent transactions
- Dashboard layout (sidebar, topbar, mobile bottom nav, branch selector, "more" sheet)

**Inventory:**
- Stock overview พร้อม lots, FIFO, WAC
- Expandable rows, branch/category filter
- Stocktake (physical vs system qty, discrepancy tracking)
- History (filters: type, branch, item, date)

**Stock Operations (NEW):**
- Stock-In page (`/stock-in`) — dedicated form with item search, supplier, expiry, notes
- Stock-Out page (`/stock-out`) — form with reason selector, current stock info, estimated value
- Transfer page (`/transfer`) — form with source/target branch, WAC display, validation
- Inventory page buttons wired to navigate to stock-in/stock-out pages

**Master Data:**
- Items (CRUD, search, category filter, admin gating, auto-computed price unit from selected unit)
- Branches (CRUD + HQ badge)
- Units, Categories, Suppliers (simple CRUD)

**Advanced:**
- Cost Calculator (menu ingredients + overheads + recommended prices)
- Users (admin only, role management)
- Reports (stock movement + print)
- Value Report (stock value by category + WAC + print)

**Components:**
- Transaction Modal (Stock In/Out/Transfer) + FIFO info + validation

**API:**
- `/api/transactions` (server-side FIFO)
- `/api/stocktake` (batch adjustments)

### Phase 3: LINE OA + LIFF + Sheets Sync ✅
- **LINE Webhook:** `/api/line/webhook`
  - Commands: สต็อก, เช็คสต็อก, รับเข้า, เบิก, รายงาน
  - Image → OCR trigger
  - Help command
- **LINE Utils:** lib/line.ts (signature, reply/push, flex messages)
- **LIFF Pages:**
  - `/liff` - Home (4 quick actions)
  - `/liff/stock-in` - Quick stock-in form
  - `/liff/stock-out` - Quick stock-out form
  - `/liff/check` - Stock check
  - `app/liff/layout.tsx` - SDK init + minimal header
- **Google Sheets Sync:**
  - `lib/google-sheets.ts` (JWT via crypto.subtle)
  - `/api/sync/sheets` (Supabase webhook → Sheets)

### Phase 4: OCR Receipt Processing ✅
- **OCR Utils:** `lib/ocr.ts`
  - downloadLineImage, parseReceiptWithGPT (GPT-4o Vision)
  - parseReceiptFallback (regex, works without OpenAI key)
  - matchItemsToInventory
- **OCR Process API:** `/api/ocr/process`
- **OCR Confirm API:** `/api/ocr/confirm`

### Data Migration ✅
- `scripts/migrate-sheets-to-supabase.ts` (14 GAS sheets → Supabase)
- Migration counts:
  - units: 13
  - categories: 12
  - suppliers: 21
  - branches: 5
  - items: 401
  - inventory: 434 (1,112 skipped - zero qty lots)
  - transactions: 2,604 (15 skipped - missing item/branch)
  - menus: 1
  - profiles: 10 (via direct SQL)
  - auth.users: 10 (via direct SQL - Admin API broken)

### Auth Issue - RESOLVED ✅
- Issue: Redirect loop after login (app/page.tsx had unconditional redirect)
- Fix: Deleted app/page.tsx so dashboard route group serves /
- Status: Production working - login successful

---

## Build Status

| รายการ | สถานะ |
|--------|-------|
| `npm run build` | ✅ ผ่าน 0 errors |
| TypeScript | ✅ Strict mode, 0 errors |
| Routes | 31 (24 static + 7 API) |

---

## Key Files

### App Routes (24 pages)
```
app/(auth)/login/page.tsx                 # /login
app/(auth)/change-password/page.tsx      # /change-password
app/(dashboard)/layout.tsx                # Dashboard shell
app/(dashboard)/page.tsx                  # Dashboard
app/(dashboard)/inventory/page.tsx       # /inventory
app/(dashboard)/stock-in/page.tsx        # /stock-in (NEW)
app/(dashboard)/stock-out/page.tsx       # /stock-out (NEW)
app/(dashboard)/transfer/page.tsx        # /transfer (NEW)
app/(dashboard)/stocktake/page.tsx       # /stocktake
app/(dashboard)/history/page.tsx         # /history
app/(dashboard)/items/page.tsx            # /items
app/(dashboard)/branches/page.tsx         # /branches
app/(dashboard)/units/page.tsx            # /units
app/(dashboard)/categories/page.tsx       # /categories
app/(dashboard)/suppliers/page.tsx       # /suppliers
app/(dashboard)/cost-calculator/page.tsx # /cost-calculator
app/(dashboard)/users/page.tsx            # /users
app/(dashboard)/reports/page.tsx          # /reports
app/(dashboard)/value-report/page.tsx    # /value-report
app/liff/layout.tsx                       # /liff layout
app/liff/page.tsx                         # /liff
app/liff/stock-in/page.tsx                # /liff/stock-in
app/liff/stock-out/page.tsx               # /liff/stock-out
app/liff/check/page.tsx                   # /liff/check
```

### API Routes (6)
```
app/api/transactions/route.ts   # Transaction + FIFO
app/api/stocktake/route.ts      # Batch stocktake
app/api/line/webhook/route.ts   # LINE webhook
app/api/sync/sheets/route.ts   # Sheets sync
app/api/ocr/process/route.ts   # OCR processing
app/api/ocr/confirm/route.ts   # OCR confirmation
```

### Foundation
```
supabase/schema.sql            # Database (13 tables)
types/database.ts              # TypeScript types
lib/utils.ts                   # Utilities
lib/utils/fifo.ts              # FIFO logic
lib/supabase/                  # Clients
lib/line.ts                    # LINE API
lib/google-sheets.ts           # Sheets API
lib/ocr.ts                     # OCR
stores/                        # Zustand
components/                    # UI
middleware.ts                  # Auth
scripts/migrate-sheets-to-supabase.ts
```

---

## Current State

**🚀 พร้อมใช้งานจริง!** (2026-03-05)
- Production URL: https://ko-stock-system.vercel.app/
- Login: admin@ko-stock.local / KO@admin
- All data migrated and accessible
- Auth working (fixed redirect loop)

### Users (10 accounts)
| Username | Email | Role |
|----------|-------|------|
| admin | admin@ko-stock.local | master |
| monchai | monchai@ko-stock.local | admin |
| vivo | vivo@ko-stock.local | admin |
| mali | mali@ko-stock.local | admin |
| ranran | ranran@ko-stock.local | admin |
| mssp | mssp@ko-stock.local | admin |
| apple | apple@ko-stock.local | admin |
| kobkob | kobkob@ko-stock.local | admin |
| aomaom | aomaom@ko-stock.local | admin |
| koikoi | koikoi@ko-stock.local | master |

Password for all: KO@username

---

## Important Notes
- Next.js 16 warning: middleware deprecated → proxy (ยังไม่ critical)
- Tailwind v4: config ใน CSS `@theme inline`
- All UI text: Thai, code comments: English
- LSP phantom errors from old deleted `app/` directories - **IGNORE**
- Google Sheets sync: JWT via crypto.subtle (Edge-compatible)
- OCR: GPT-4o Vision primary + regex fallback (ใช้ได้ without API key)
---

*Last updated: 2026-03-05*
