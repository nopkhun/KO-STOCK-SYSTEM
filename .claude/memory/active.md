# Active Task

## Current Focus
Auth redirect loop fix deployed -- awaiting user confirmation.

## Just Completed (2026-03-05)
1. **Root Cause Found: Auth Redirect Loop**
   - `app/page.tsx` had `redirect("/login")` unconditionally
   - This ran before `app/(dashboard)/page.tsx` could serve `/`
   - After login, `window.location.href = "/"` hit this redirect -> loop
   - **Fix:** Deleted `app/page.tsx` so route group serves `/`

2. **Login page guard** -- added redirect-to-dashboard for already-authed users

3. **Removed `/api/debug-auth`** -- temporary diagnostic endpoint cleaned up

4. **Committed migration scripts** -- migrate-v2.ts, migrate-users.ts, check-data.ts, peek-users.ts, migrate-users.sql, fix-trigger.sql

5. **Added supabase/.temp/ to .gitignore**

## Previous Completed (2026-03-04)
- All 4 phases of code complete
- All data migrated to Supabase (see summary.md for counts)
- 10 users created via direct SQL
- Middleware rewritten: only refreshes cookies, no auth redirects
- Dashboard layout: client-side auth guard

## Next Steps
1. **VERIFY**: Login works on production after Vercel redeploy
2. Test all dashboard pages with real data
3. Set up LINE OA webhook URL -> https://ko-stock-system.vercel.app/api/line/webhook
4. Set up LIFF endpoint URL -> https://ko-stock-system.vercel.app/liff
5. Set up Supabase Webhook -> Google Sheets sync
6. (Optional) Add OPENAI_API_KEY to Vercel env vars for OCR

## Blockers / Issues
- middleware.ts warning: Next.js 16 deprecates middleware -> proxy (not critical)
- LSP phantom errors: files in app/ that don't exist - ignore

---
*Last updated: 2026-03-05*
