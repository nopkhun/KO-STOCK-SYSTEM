# Active Task

## Current Focus
**แก้ไข History + Reports ไม่แสดงข้อมูล** (2026-03-05)

## Completed (2026-03-05)
1. ✅ Auth redirect loop fixed - login now works
2. ✅ Removed temporary debug-auth endpoint
3. ✅ Committed migration scripts
4. ✅ Memory files updated
5. ✅ Fixed History page not displaying transactions
6. ✅ Fixed Reports page not displaying data
7. ✅ Fixed Supabase FK hint for performer join

## Bug Fixes Applied (2026-03-05)
### Problem: ประวัติการทำรายการและรายงานไม่แสดง
**Root causes:**
1. **Supabase query FK hint error** - `profiles!transactions_performed_by_fkey` references a FK that doesn't exist in schema (performed_by has no FK constraint). Changed to `profiles(id, username)` for PostgREST auto-inference.
2. **Silent error swallowing** - Both inventory store and reports page caught errors silently. Added console.error logging + fallback queries.
3. **History loading state** - `loading || masterLoading` could get stuck if masterLoading never resolves. Simplified to single loading state with try/finally.
4. **Reports required manual click** - Reports page required clicking "ค้นหา" first. Added auto-fetch on page load.

**Files changed:**
- `stores/inventory.ts` - Fixed FK hint, added error logging + fallback
- `app/(dashboard)/history/page.tsx` - Fixed loading state, cleanup on unmount
- `app/(dashboard)/reports/page.tsx` - Fixed FK hint, added auto-fetch, error logging + fallback

## Production Status
- **URL:** https://ko-stock-system.vercel.app/
- **Login:** admin@ko-stock.local / KO@admin
- **Build:** 0 TypeScript errors ✅

## Next Steps (Optional)
1. Set up LINE OA webhook -> https://ko-stock-system.vercel.app/api/line/webhook
2. Set up LIFF endpoint -> https://ko-stock-system.vercel.app/liff
3. Set up Supabase Webhook -> Google Sheets sync
4. Add OPENAI_API_KEY for OCR (optional)
5. **Add FK constraint for performed_by -> profiles(id) in Supabase** (recommended)

## Blockers / Issues
- `performed_by` column in transactions table has no FK constraint to profiles - should add via Supabase SQL editor

---
*Last updated: 2026-03-05*
