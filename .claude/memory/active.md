# Active Task

## Current Focus
**Feature: Stock Operations Pages + Items Price Unit Fix** (2026-03-05)

## Completed (2026-03-05)
1. Created `/stock-in` page — dedicated stock-in form with item search, branch selector, amount, unit price, supplier, expiry, notes, recent transactions
2. Created `/transfer` page — transfer form with source/target branch, current stock + WAC display, insufficient stock validation
3. Created `/stock-out` page — stock-out form with reason selector, current stock info, estimated value
4. Updated sidebar nav — added นำเข้าสินค้า, เบิกของ, โอนย้าย to `mainNav` (appears in sidebar + mobile "more" sheet)
5. Connected inventory page buttons — "รับเข้า" and "เบิกออก" buttons (desktop + mobile) now navigate to `/stock-in?item=` and `/stock-out?item=`
6. Fixed items page price unit — removed freeform `custom_price_unit` input, now auto-computes as `บาท/{unit.name}` based on selected unit, displayed as read-only text
7. Build verified — `npm run build` passes with 0 TypeScript errors, 31 routes total

## Production Status
- **URL:** https://ko-stock-system.vercel.app/
- **Login:** admin@ko-stock.local / KO@admin
- **Build:** 0 TypeScript errors
- **Routes:** 31 (24 static + 7 API)

## New Pages Added
- `/stock-in` — นำเข้าสินค้า
- `/stock-out` — เบิกของ
- `/transfer` — โอนย้ายสาขา

## Next Steps (Optional)
1. Set up LINE OA webhook -> https://ko-stock-system.vercel.app/api/line/webhook
2. Set up LIFF endpoint -> https://ko-stock-system.vercel.app/liff
3. Set up Supabase Webhook -> Google Sheets sync
4. Add OPENAI_API_KEY for OCR (optional)
5. Deploy latest changes to Vercel

## Blockers / Issues
- None

---
*Last updated: 2026-03-05*
