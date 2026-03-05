# Active Task

## Current Focus
**Items Page Enhancement - ALL FEATURES COMPLETE** (2026-03-05)

## Completed (2026-03-05) - Items Enhancement
1. **master-data store** - Added `item_suppliers(*)` to items fetch query
2. **Auto-populate item_suppliers** - Transaction API auto-upserts on stock-in
3. **OCR name learning** - Confirm API saves parsed_name as name_at_supplier
4. **Stock recommendations** - New utility: recommended min stock (avg daily usage × 5 days) + recommended price (WAC)
5. **OCR matching enhanced** - Matches against name_at_supplier + items.name with supplier context
6. **OCR process enhanced** - Fetches item_suppliers, detects supplier from receipt, passes to matching
7. **Items page rewritten** - Complete rewrite with:
   - Recommended price (WAC) with "ใช้ค่านี้" button
   - Recommended min stock with "ใช้ค่านี้" button
   - Supplier mappings section (add/remove/edit supplier + name_at_supplier)
   - Supplier badges in table and mobile cards
8. **Value report UI** - Clarified WAC/real cost methodology:
   - Updated subtitle, summary card label, column header
   - Added info banner explaining WAC calculation
   - Updated print header with footnote
9. **Build verified** - `npm run build` passes with 0 TypeScript errors

## Files Modified
- `stores/master-data.ts`
- `app/api/transactions/route.ts`
- `app/api/ocr/confirm/route.ts`
- `lib/ocr.ts`
- `app/api/ocr/process/route.ts`
- `app/(dashboard)/items/page.tsx`
- `app/(dashboard)/value-report/page.tsx`

## Files Created
- `lib/utils/stock-recommendations.ts`

## Production Status
- **URL:** https://ko-stock-system.vercel.app/
- **Login:** admin@ko-stock.local / KO@admin
- **Build:** 0 TypeScript errors

## Next Steps (Optional)
1. Deploy changes to Vercel (commit & push)
2. Set up LINE OA webhook
3. Set up LIFF endpoint
4. Set up Supabase Webhook -> Google Sheets sync
5. Add OPENAI_API_KEY for OCR

## Blockers / Issues
- None

---
*Last updated: 2026-03-05*
