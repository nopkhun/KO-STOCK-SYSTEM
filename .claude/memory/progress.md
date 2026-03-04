# รายงานความคืบหน้าโครงการ KO-Stock-System

**อัปเดตล่าสุด:** 4 มีนาคม 2026

---

## ภาพรวมโครงการ

| รายการ | รายละเอียด |
|--------|------------|
| **ชื่อโปรเจกต์** | KO-Stock-System (ระบบคลังวัตถุดิบร้านอาหาร) |
| **เป้าหมาย** | ย้ายระบบจาก Google Apps Script + Google Sheets มาเป็น Next.js 16 + Supabase |
| **Tech Stack** | Next.js 16, React 19, Tailwind v4, shadcn/ui, Zustand, Supabase |
| **งบประมาณ** | 0 บาท/เดือน (ใช้ free tier ทั้งหมด) |
| **สถานะ** | ✅ เขียนโค้ดเสร็จสมบูรณ์ (4 เฟส) |

---

## สรุปความคืบหน้าแต่ละเฟส

### เฟส 1: ฐานระบบ (Foundation) ✅ เสร็จสมบูรณ์

- [x] สร้างโปรเจกต์ Next.js 16 พร้อม TypeScript strict
- [x] ติดตั้ง dependencies ทั้งหมด
- [x] ออกแบบ Supabase schema (13 ตาราง, RLS, triggers, seed data)
- [x] สร้าง TypeScript types สำหรับทุกตาราง
- [x] สร้าง utilities (cn, formatters, FIFO, debounce)
- [x] ตั้งค่า Supabase clients (browser + server)
- [x] สร้าง auth middleware
- [x] สร้าง Zustand stores (auth, master-data, inventory, ui)
- [x] ติดตั้ง shadcn/ui components
- [x] สร้าง Toast notification system
- [x] อัปเดต App layout และ CSS (Tailwind v4)

### เฟส 2: ความเทียบเท่าฟีเจอร์ (Feature Parity) ✅ เสร็จสมบูรณ์

#### หน้าต่างๆ (16 หน้า)
- [x] **Auth:** Login, Change Password
- [x] **Dashboard:** หน้าหลัก (summary cards, low stock alerts, recent transactions)
- [x] **Inventory:** สต็อกคงคลัง (lots, FIFO, WAC, expandable rows)
- [x] **Stocktake:** ตรวจนับสต็อก (physical vs system qty, discrepancy)
- [x] **History:** ประวัติรายการ (filters: type, branch, item, date)
- [x] **Items:** จัดการวัตถุดิบ (CRUD, search, category filter)
- [x] **Branches:** จัดการสาขา (CRUD + HQ badge)
- [x] **Units:** จัดการหน่วยนับ
- [x] **Categories:** จัดการหมวดหมู่
- [x] **Suppliers:** จัดการผู้จัดหา
- [x] **Cost Calculator:** คำนวณต้นทุนเมนู
- [x] **Users:** จัดการผู้ใช้ (admin only)
- [x] **Reports:** รายงานการเคลื่อนไหวสต็อก
- [x] **Value Report:** รายงานมูลค่าสต็อก
- [x] **Dashboard Layout:** Sidebar, topbar, mobile bottom nav, branch selector

#### Components
- [x] Transaction Modal (Stock In/Out/Transfer) พร้อม FIFO info
- [x] Providers component (auth + master data + Toast)
- [x] shadcn/ui components ทั้งหมด

#### API Routes
- [x] `/api/transactions` - Transaction CRUD พร้อม server-side FIFO
- [x] `/api/stocktake` - Batch stocktake adjustments

### เฟส 3: LINE OA + LIFF + Google Sheets Sync ✅ เสร็จสมบูรณ์

- [x] **LINE Webhook:** `/api/line/webhook`
  - รองรับคำสั่ง: สต็อก, เช็คสต็อก, รับเข้า, เบิก, รายงาน
  - รองรับส่งรูปภาพ → OCR
  - รองรับ help command
- [x] **LINE Utils:** `lib/line.ts` - signature validation, reply/push, flex messages
- [x] **LIFF Pages:**
  - [x] `/liff` - หน้าหลัก LIFF (4 ปุ่ม quick actions)
  - [x] `/liff/stock-in` - ฟอร์มรับเข้าสต็อกด่วน
  - [x] `/liff/stock-out` - ฟอร์มเบิกสต็อกด่วน
  - [x] `/liff/check` - เช็คสต็อก
  - [x] `app/liff/layout.tsx` - LIFF SDK init, minimal header
- [x] **Google Sheets Sync:**
  - [x] `lib/google-sheets.ts` - Sheets API v4 (JWT via crypto.subtle)
  - [x] `/api/sync/sheets` - Supabase webhook → Sheets sync

### เฟส 4: OCR Receipt Processing ✅ เสร็จสมบูรณ์

- [x] **OCR Utils:** `lib/ocr.ts`
  - downloadLineImage - ดาวน์โหลดรูปจาก LINE
  - parseReceiptWithGPT - ประมวลผลด้วย GPT-4o Vision
  - parseReceiptFallback - regex parser (ใช้ได้แม้ไม่มี OpenAI key)
  - matchItemsToInventory - จับคู่รายการกับสต็อก
- [x] **OCR Process API:** `/api/ocr/process`
  - LINE image → GPT-4o Vision → parsed receipt → matched items
- [x] **OCR Confirm API:** `/api/ocr/confirm`
  - Confirm → สร้าง stock-in transactions

### Data Migration ✅ เสร็จสมบูรณ์

- [x] `scripts/migrate-sheets-to-supabase.ts` - Script ย้ายข้อมูลจาก 14 GAS sheets
  - อ่านข้อมูลจาก Google Sheets
  - สร้าง ID maps (old GAS ID → new UUID)
  - Migrate ตามลำดับ dependencies
  - รองรับ dry-run และ --execute flag

---

## สถานะการ Build

| รายการ | สถานะ |
|--------|-------|
| `npm run build` | ✅ ผ่าน 0 errors |
| TypeScript | ✅ ไม่มี error |
| Routes ทั้งหมด | 28 routes (22 static + 6 dynamic API) |

### Route Breakdown
```
Pages (22):
- / (redirect to /login)
- /login, /change-password
- /inventory, /stocktake, /history
- /items, /branches, /units, /categories, /suppliers
- /cost-calculator, /users, /reports, /value-report
- /liff, /liff/stock-in, /liff/stock-out, /liff/check

API Routes (6):
- /api/transactions, /api/stocktake
- /api/line/webhook, /api/sync/sheets
- /api/ocr/process, /api/ocr/confirm
```

---

## รายการที่ต้องทำต่อ (Next Steps)

### ขั้นตอนการตั้งค่า (สำหรับผู้ใช้)

> **ดูรายละเอียดฉบับเต็ม:** [.claude/memory/DEPLOY.md](./DEPLOY.md)

1. **สร้าง Supabase Project** → Run schema.sql → จด URL & Keys
2. **ตั้งค่า Environment Variables** → .env.local
3. **ตั้งค่า LINE OA** → Channel, LIFF App, Webhook
4. **Deploy ไป Vercel** → เชื่อม GitHub → ใส่ Env Vars
5. **อัปเดต URLs** → Webhook, LIFF endpoint
6. **ทดสอบระบบ** → Login, LINE, LIFF
7. **(Optional) Migration** → Run script `--execute`

---

## ไฟล์สำคัญ

### App Routes
```
app/page.tsx                              # Redirect to /login
app/(auth)/login/page.tsx                 # Login
app/(auth)/change-password/page.tsx      # Change Password
app/(dashboard)/layout.tsx                # Dashboard shell
app/(dashboard)/page.tsx                  # Dashboard
app/(dashboard)/inventory/page.tsx        # Inventory
app/(dashboard)/stocktake/page.tsx        # Stocktake
app/(dashboard)/history/page.tsx          # History
app/(dashboard)/items/page.tsx            # Items
app/(dashboard)/branches/page.tsx         # Branches
app/(dashboard)/units/page.tsx            # Units
app/(dashboard)/categories/page.tsx       # Categories
app/(dashboard)/suppliers/page.tsx        # Suppliers
app/(dashboard)/cost-calculator/page.tsx # Cost Calculator
app/(dashboard)/users/page.tsx            # Users
app/(dashboard)/reports/page.tsx          # Reports
app/(dashboard)/value-report/page.tsx    # Value Report
app/liff/layout.tsx                       # LIFF layout
app/liff/page.tsx                         # LIFF home
app/liff/stock-in/page.tsx                # LIFF Stock In
app/liff/stock-out/page.tsx               # LIFF Stock Out
app/liff/check/page.tsx                   # LIFF Stock Check
```

### API Routes
```
app/api/transactions/route.ts    # Transaction CRUD + FIFO
app/api/stocktake/route.ts       # Batch stocktake
app/api/line/webhook/route.ts    # LINE webhook
app/api/sync/sheets/route.ts    # Google Sheets sync
app/api/ocr/process/route.ts     # OCR processing
app/api/ocr/confirm/route.ts    # OCR confirmation
```

### Core Files
```
supabase/schema.sql             # Database schema (13 tables)
types/database.ts               # TypeScript types
lib/utils.ts                    # Utilities
lib/utils/fifo.ts               # FIFO logic
lib/supabase/client.ts          # Browser client
lib/supabase/server.ts          # Server client
lib/line.ts                     # LINE utilities
lib/google-sheets.ts            # Sheets API client
lib/ocr.ts                      # OCR utilities
stores/                         # Zustand stores
components/                     # UI components
middleware.ts                   # Auth middleware
scripts/migrate-sheets-to-supabase.ts  # Migration script
```

### Reference (Original GAS - ไม่ต้องแก้ไข)
```
Code.gs           # 2250 lines
Index.html        # 4848 lines
Code-backup.gs
Index-backup.html
```

---

## ปัญหาที่รู้แล้ว (Known Issues)

| ปัญหา | สถานะ | หมายเหตุ |
|-------|-------|----------|
| middleware.ts warning | ทราบ | Next.js 16 deprecates middleware, ใช้ "proxy" แทน (ยังไม่ critical) |
| LSP phantom errors | ทราบ | errors เกี่ยวกับไฟล์ใน `app/` ที่ไม่มีจริง (ไฟล์เก่าที่ลบแล้ว) - ignore ได้ |
| No .env.local | ต้องทำ | ต้องสร้างจาก .env.example |
| Multiple lockfiles | ทราบ | มี 2 package-lock.json (root + project) - ไม่มีผลต่อการทำงาน |

---

## ตารางเปรียบเทียบ: ก่อน vs หลัง

| หัวข้อ | ระบบเดิม (GAS) | ระบบใหม่ (Next.js) |
|--------|----------------|-------------------|
| Database | Google Sheets (14 ไฟล์) | Supabase (13 tables) |
| Auth | GAS Session | Supabase Auth |
| UI | HTML/CSS ใน GAS | Next.js + Tailwind v4 |
| LINE | Manual reply | LINE Webhook + Flex Message |
| LIFF | ไม่มี | LIFF App |
| OCR | ไม่มี | GPT-4o Vision + Fallback |
| Sheets Sync | Manual | Realtime via Webhook |
| TypeScript | ไม่มี | Strict Mode |
| FIFO | Client-side | Server-side (可靠) |

---

*Report generated: 2026-03-04*
