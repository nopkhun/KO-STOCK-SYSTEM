# 🎉 KO-Stock-System v1.0 Release Notes

**Release Date:** 2026-03-05  
**Version:** 1.0.0  
**Status:** ✅ Production Ready

---

## 🚀 Production URL

**https://ko-stock-system.vercel.app/**

### Test Accounts
| Username | Email | Role | Password |
|----------|-------|------|----------|
| admin | admin@ko-stock.local | master | KO@admin |
| koikoi | koikoi@ko-stock.local | master | KO@koikoi |
| monchai | monchai@ko-stock.local | admin | KO@monchai |
| vivo | vivo@ko-stock.local | admin | KO@vivo |
| mali | mali@ko-stock.local | admin | KO@mali |
| ranran | ranran@ko-stock.local | admin | KO@ranran |
| mssp | mssp@ko-stock.local | admin | KO@mssp |
| apple | apple@ko-stock.local | admin | KO@apple |
| kobkob | kobkob@ko-stock.local | admin | KO@kobkob |
| aomaom | aomaom@ko-stock.local | admin | KO@aomaom |

---

## ✅ Migration Complete

### What was migrated from Google Apps Script + Sheets:
| Data | Count | Status |
|------|-------|--------|
| Units | 13 | ✅ |
| Categories | 12 | ✅ |
| Suppliers | 21 | ✅ |
| Branches | 5 | ✅ |
| Items | 401 | ✅ |
| Inventory Lots | 434 | ✅ |
| Transactions | 2,604 | ✅ |
| Menus | 1 | ✅ |
| Users | 10 | ✅ |

---

## 📦 Features

### Phase 1: Foundation
- Next.js 16 + React 19 + TypeScript
- Supabase database with RLS
- Zustand state management
- shadcn/ui components
- Tailwind v4 theme (orange)

### Phase 2: Feature Parity
- **Auth:** Login, change password
- **Dashboard:** Summary cards, low stock alerts, recent transactions
- **Inventory:** Stock overview, FIFO, WAC, stocktake, history
- **Master Data:** Items, branches, units, categories, suppliers
- **Tools:** Cost calculator, reports, value report, user management

### Phase 3: LINE + Sheets
- LINE webhook with Thai commands (สต็อก, รับเข้า, เบิก)
- LIFF pages (stock-in, stock-out, check)
- Google Sheets sync via Supabase webhook

### Phase 4: OCR
- GPT-4o Vision receipt parsing
- Regex fallback (works without API key)
- Manual confirmation flow

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind v4, shadcn/ui |
| State | Zustand |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Hosting | Vercel (free tier) |

---

## ⚠️ Known Issues (Resolved)

1. **Auth Redirect Loop** ✅ FIXED
   - Root cause: `app/page.tsx` had unconditional `redirect("/login")`
   - Fix: Removed file, dashboard route group now serves `/`
   - Status: Working in production

2. **Supabase Admin API** ⚠️ WORKAROUND
   - Issue: `auth.admin.createUser()` returns HTTP 500
   - Workaround: Created users via direct SQL
   - Status: Users created, login works

---

## 📝 Optional Setup (Not Required)

1. **LINE OA Webhook**
   - URL: `https://ko-stock-system.vercel.app/api/line/webhook`
   - Set in LINE Official Account console

2. **LIFF Endpoint**
   - URL: `https://ko-stock-system.vercel.app/liff`
   - Set in LINE Developer console

3. **Supabase → Google Sheets Webhook**
   - Create database webhook on tables
   - Point to `/api/sync/sheets`

4. **OCR (Optional)**
   - Add `OPENAI_API_KEY` to Vercel env vars
   - Enables GPT-4o Vision for receipt parsing

---

## 📁 Key Files

```
app/(dashboard)/           # 13 dashboard pages
app/(auth)/               # Login, change-password
app/api/                  # 6 API routes
app/liff/                 # 4 LIFF pages
lib/supabase/             # Clients
lib/line.ts               # LINE utilities
lib/ocr.ts                # OCR utilities
lib/google-sheets.ts      # Sheets sync
stores/                   # Zustand stores
supabase/schema.sql       # Database schema
scripts/                  # Migration scripts
```

---

## 🔧 Build Status

| Check | Status |
|-------|--------|
| `npm run build` | ✅ Pass |
| TypeScript | ✅ 0 errors |
| Routes | 27 (21 static + 6 API) |

---

*Generated: 2026-03-05*
