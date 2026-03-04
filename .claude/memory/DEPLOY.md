# คู่มือ Deploy KO-Stock-System สู่ Production

**อัปเดต:** 4 มีนาคม 2026

---

## ภาพรวม

| รายการ | รายละเอียด |
|--------|------------|
| **Frontend** | Vercel (Free Tier) |
| **Database** | Supabase (Free Tier) |
| **LINE OA** | LINE Official Account (Free) |
| **Google Sheets** | มี Service Account แล้ว |
| **OCR** | OpenAI API (Pay-per-use) หรือใช้ Free Fallback |

**งบประมาณ:** 0-50 บาท/เดือน (ถ้าใช้ OpenAI OCR)

---

## Step 1: สร้าง Supabase Project

### 1.1 ไปที่ Supabase
```
https://supabase.com
```
- คลิก "New Project"
- เลือก Organization (สร้างใหม่ถ้ายังไม่มี)
- ตั้งชื่อ Project: `ko-stock-system`
- ใส่ Database Password: **จดไว้ให้ดี** (ต้องใช้หลังจากนี้)
- เลือก Region: เลือกใกล้ที่สุด (Singapore หรือ Bangkok)
- คลิก "Create new project"

**รอประมาณ 2 นาที** ให้ Supabase สร้าง project เสร็จ

### 1.2 จด URL และ Keys
เมื่อสร้าเสร็จ จะเห็นหน้า Project Settings:

| ค่า | ตำแหน่ง | จดไว้ |
|-----|---------|-------|
| `Project URL` | Settings → API | เช่น `https://xxxxx.supabase.co` |
| `anon public` | Settings → API → Project API keys | เช่น `eyJhbGciOiJIUzI1NiIsInR5cCI6...` |
| `service_role` | Settings → API → Project API keys | **กด "Generate" ถ้ายังไม่มี** — เก็บไว้ ใช้ใน server-side |

---

## Step 2: Run Schema SQL

### 2.1 เปิด SQL Editor
ใน Supabase Dashboard → ไปที่ **SQL Editor** (เมนูด้านซ้าย)

### 2.2 Run Schema
1. คลิก **"New query"**
2. เปิดไฟล์ `supabase/schema.sql` ในโปรเจกต์
3. Copy ทั้งหมด
4. Paste ใน SQL Editor
5. คลิก **"Run"**

### 2.3 ผลลัพธ์ที่คาดหวัง
```
Success! No rows returned
Query runtime: 0.5s
```

### 2.4 ตรวจสอบ Tables
ไปที่ **Table Editor** (ด้านซ้าย) — ควรเห็น 13 ตาราง:
- branches, units, categories, suppliers
- items, item_suppliers
- inventory, transactions
- users, profiles
- menus, menu_ingredients, menu_overheads

### 2.5 เปิดใช้งาน RLS (Row Level Security)
Schema นี้มี RLS อยู่แล้ว ตรวจสอบว่าเปิดอยู่:
- ไปที่แต่ละ table → **Storage** → เลือก table → ดูที่ **Row Level Security**
- ควรเห็น policy เช่น `users can view own data`, `anyone can read profiles`

### 2.6 สร้าง Webhook Secret
ไปที่ **Database** → **Webhooks** → **Create webhook**:
- Name: `sheets-sync`
- URL: `https://YOUR-DOMAIN.com/api/sync/sheets` (ใส่ชั่วคราว จะแก้ทีหลัง)
- Events: เลือก `INSERT`, `UPDATE`, `DELETE`
- Tables: เลือกทุก table ที่ต้องการ sync
- **Copy webhook secret** ที่ Supabase สร้างให้ — จะใช้เป็น `SUPABASE_WEBHOOK_SECRET`

---

## Step 3: ตั้งค่า Environment Variables

### 3.1 สร้าง .env.local
ในโฟลเดอร์โปรเจกต์:

```bash
cp .env.example .env.local
```

### 3.2 แก้ไข .env.local

```env
# ===== Supabase (จาก Step 1.2) =====
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_WEBHOOK_SECRET=your-webhook-secret-from-step-2.6

# ===== LINE OA (สร้างใน Step 4) =====
LINE_CHANNEL_ACCESS_TOKEN=xxx
LINE_CHANNEL_SECRET=xxx
NEXT_PUBLIC_LIFF_ID=xxx

# ===== Google Sheets (ถ้ามีแล้ว) =====
GOOGLE_SHEETS_SPREADSHEET_ID=xxx
GOOGLE_SERVICE_ACCOUNT_EMAIL=xxx@xxx.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# ===== OCR (Optional - ถ้ามี OpenAI) =====
# OPENAI_API_KEY=sk-...
```

---

## Step 4: ตั้งค่า LINE Official Account

### 4.1 สร้าง LINE Developer Channel
1. ไปที่ https://developers.line.gov/
2. เข้าสู่ระบบด้วย LINE account
3. คลิก **"Create a new channel"** → **"Messaging API"**
4. กรอกข้อมูล:
   - Channel name: `KO Stock System`
   - Channel description: `ระบบคลังวัตถุดิบร้านอาหาร`
   - Category: Business
   - Subcategory: Retail
5. ยอมรับ Terms → Create

### 4.2 ตั้งค่า Channel
เมื่อสร้างเสร็จ จะเข้าหน้า Channel settings:

| ค่า | ตำแหน่ง | จดไว้ |
|-----|---------|-------|
| Channel ID | Basic settings | เช่น `2000000001` |
| Channel secret | Basic settings → Channel secret | เช่น `abc123...` |
| Access token | Messaging API → Channel access token | เช่น `xxx...` — **กด "Issue" ถ้ายังไม่มี** |

### 4.3 สร้าง LIFF App
1. ไปที่ **LINE Official Account Managers** → เลือก OA ที่สร้าง
2. ไปที่ **LIFF** (เมนูด้านซ้าย)
3. คลิก **"Add"**
4. กรอกข้อมูล:
   - LIFF app name: `KO Stock LIFF`
   - Size: `Full` (หรือ `Compact`)
   - Endpoint URL: `https://YOUR-DOMAIN.com/liff` (ใส่ชั่วคราว)
   -Scopes: `openid`, `profile`
5. คลิก **"Create"**
6. **จด LIFF ID** — จะอยู่ในรูป `2000000001-Oxxxxx`

### 4.4 ตั้งค่า Webhook
1. ใน LINE Developers → Channel ของคุณ
2. ไปที่ **Messaging API** → **Webhook settings**
3. เปิด **"Use webhook"**
4. Webhook URL: `https://YOUR-DOMAIN.com/api/line/webhook`
5. คลิก **"Update"** → **"Verify"** (จะ error ก่อน deploy ไม่เป็นไร)

---

## Step 5: Deploy ไป Vercel

### 5.1 เชื่อมต่อ GitHub
1. ไปที่ https://vercel.com
2. คลิก **"Add New..."** → **"Project"**
3. เลือก GitHub repo: `KO-Stock-System`
4. คลิก **"Import"**

### 5.2 ตั้งค่า Project
- Framework Preset: **Next.js** (auto-detect)
- Root Directory: `.` (ไม่ต้องแก้)
- Build Command: `next build` (default)
- Output Directory: `.next` (default)

### 5.3 Environment Variables
เลื่อนลงมาด้านล่าง จะเห็น **"Environment Variables"**:
1. คลิก **"Add"** ทีละตัว หรือ **"Paste"** ทั้งหมด
2. Copy ข้อมูลจาก `.env.local` มาใส่
3. ต้องมีครบทุกตัว:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_WEBHOOK_SECRET`
   - `LINE_CHANNEL_ACCESS_TOKEN`
   - `LINE_CHANNEL_SECRET`
   - `NEXT_PUBLIC_LIFF_ID`
   - `GOOGLE_SHEETS_*` (ถ้ามี)
   - `OPENAI_API_KEY` (ถ้ามี)

### 5.4 Deploy
คลิก **"Deploy"** — รอประมาณ 3-5 นาที

### 5.5 จด Domain
เมื่อ deploy เสร็จ จะได้ URL เช่น:
```
https://ko-stock-system.vercel.app
```

**Copy ไว้** — ต้องใช้ในขั้นตอนถัดไป

---

## Step 6: Update URLs หลัง Deploy

### 6.1 อัปเดต Supabase Webhook
1. ไปที่ Supabase → **Database** → **Webhooks**
2. แก้ URL เป็น: `https://YOUR-VERCEL-DOMAIN.com/api/sync/sheets`
3. คลิก **"Save"**

### 6.2 อัปเดต LINE Webhook
1. ไปที่ LINE Developers → Channel → **Messaging API** → **Webhook settings**
2. แก้ URL เป็น: `https://YOUR-VERCEL-DOMAIN.com/api/line/webhook`
3. คลิก **"Update"** → **"Verify"**

### 6.3 อัปเดต LIFF Endpoint
1. ไปที่ LINE Official Account Managers → **LIFF**
2. แก้ Endpoint URL เป็น: `https://YOUR-VERCEL-DOMAIN.com/liff`
3. คลิก **"Update"**

---

## Step 7: ทดสอบระบบ

### 7.1 ทดสอบ Login
1. เปิด Browser → ไปที่ `https://YOUR-VERCEL-DOMAIN.com/login`
2. ลอง Sign Up ด้วย email (Supabase Auth จะส่ง confirmation email)
3. หรือ ใช้ Supabase Dashboard → **Authentication** → **Users** → **"Create user"**

### 7.2 ทดสอบ LINE
1. เปิด LINE → ค้นหา OA ที่สร้าง
2. ส่งข้อความ: `สต็อก`
3. ควรตอบกลับเป็นรายงานสต็อก

### 7.3 ทดสอบ LIFF
1. ใน LINE → กดปุ่ม ≡ → **Add**
2. ค้นหา LIFF app name ที่สร้าง
3. กดเปิด → จะเปิดใน LINE Browser

---

## Step 8: Migration ข้อมูล (Optional)

ถ้าต้องการย้ายข้อมูลจาก Google Sheets เดิม:

### 8.1 เตรียม Google Sheets
1. เปิด Google Sheets ที่ใช้ใน GAS เดิม
2. Share ให้ Service Account (อีเมลที่ได้จาก `GOOGLE_SERVICE_ACCOUNT_EMAIL`)
3. จด **Spreadsheet ID** (ตัวที่อยู่ใน URL: `/d/SPREADSHEET_ID/edit`)

### 8.2 Run Migration Script
```bash
# Dry run ก่อน (ดู preview)
npx tsx scripts/migrate-sheets-to-supabase.ts

# ถ้าโอเค ให้ execute
npx tsx scripts/migrate-sheets-to-supabase.ts --execute
```

---

## รวม URLs ที่ต้องจด

| ค่า | ตำแหน่ง | ตัวอย่าง |
|-----|---------|---------|
| **Vercel Domain** | Vercel Dashboard | `ko-stock-system.vercel.app` |
| **Supabase URL** | Supabase → Settings → API | `https://xxxx.supabase.co` |
| **Supabase anon key** | Supabase → Settings → API | `eyJhbGciOiJIUzI1NiIs...` |
| **Supabase service key** | Supabase → Settings → API | `eyJhbGciOiJIUzI1NiIs...` |
| **Supabase webhook secret** | Supabase → Database → Webhooks | `eh_xxxxx...` |
| **LINE Channel Secret** | LINE Developers → Channel | `abc123...` |
| **LINE Access Token** | LINE Developers → Messaging API | `xxx...` |
| **LIFF ID** | LINE OA Managers → LIFF | `2000000001-Oxxxxx` |
| **Google Sheets ID** | Google Sheets URL | `1abc...` |
| **Google Service Account** | Google Cloud Console | `xxx@xxx.iam.gserviceaccount.com` |
| **Google Private Key** | Google Cloud Console | `-----BEGIN PRIVATE KEY-----\n...` |
| **OpenAI API Key** | OpenAI Platform | `sk-...` (optional) |

---

## Troubleshooting

### Build Error
```bash
# ถ้า build ที่ local ไม่ได้
npm run build
```

### เปิด Vercel Logs
- ไปที่ Vercel Dashboard → Your Project → **Deployments** → คลิก deployment ล่าสุด → **View Function Logs**

### LINE Webhook Error 404
- ตรวจสอบว่า URL ถูกต้อง (https ไม่ใช่ http)
- ตรวจสอบว่า deploy เสร็จแล้ว

### Supabase Connection Error
- ตรวจสอบ `NEXT_PUBLIC_SUPABASE_URL` และ `NEXT_PUBLIC_SUPABASE_ANON_KEY` ถูกต้อง
- ตรวจสอบว่า RLS ไม่ได้ปิดการ insert/update

---

## สรุป Checklist

- [ ] สร้าง Supabase Project
- [ ] Run schema.sql
- [ ] สร้าง .env.local
- [ ] สร้าง LINE Channel
- [ ] สร้าง LIFF App
- [ ] Deploy Vercel
- [ ] อัปเดต Webhook URLs
- [ ] ทดสอบ Login
- [ ] ทดสอบ LINE
- [ ] ทดสอบ LIFF
- [ ] (Optional) Run Migration Script

---

*Guide created: 2026-03-04*
