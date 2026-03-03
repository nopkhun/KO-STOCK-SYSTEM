# 🐛 Debug Log

## Current Issue
**Problem:** App still shows "ยังไม่ได้ตั้งค่าระบบ" and cannot be used
**Page/Component:** `Index.html` (setup screen), `Code.gs` (setup/getSystemData)
**Started:** 2026-02-02
**Status:** 🔴 In Progress

---

## Attempts

### Attempt 1 - Codex - 2026-02-02
- **Hypothesis:** Setup screen persists because Units/Categories sheets are missing or empty; need visibility to sheet status to isolate root cause.
- **Action:** Added `getSetupStatus(token)` in `Code.gs` and a setup-status panel + refresh button on the setup screen in `Index.html`.
- **Files Changed:** `Code.gs`, `Index.html`
- **Result:** ⏳ Pending user verification
- **Learning:** Need sheet existence/row counts to confirm whether setup or data load is the blocker.

### Attempt 2 - Codex - 2026-02-02
- **Hypothesis:** `getSystemData` returns empty arrays due to hidden exception; need debug counts/error from backend.
- **Action:** Added `_debug` and `_debugError` to `getSystemData` response; surface debug counts and error on setup screen.
- **Files Changed:** `Code.gs`, `Index.html`
- **Result:** ⏳ Pending user verification
- **Learning:** Will confirm whether backend is falling into catch or returning empty payload.

### Attempt 3 - Codex - 2026-02-02
- **Hypothesis:** No Debug line shown because latest script is not deployed or browser cache still using old HTML.
- **Action:** Ask user to deploy new version and hard refresh.
- **Files Changed:** (none)
- **Result:** ⏳ Pending user verification
- **Learning:** Need confirmation of deployment/version to proceed with root cause.

### Attempt 4 - Toh Fix - 2026-03-01 (Red screen after login)
- **Hypothesis:** TypeError `(item.name || "").toLowerCase is not a function` — backend/Sheets sometimes returns numbers for name/category; code assumed string.
- **Action:** Replaced all `(x || '').toLowerCase()` / `.trim()` / `.localeCompare()` on item.name, item.category, r.item.name, and related API fields with `String(x ?? '').toLowerCase()` etc. in Index.html.
- **Files Changed:** Index.html (filters, sort, display, WAC lookup, copy-form names)
- **Result:** ✅ Fixed
- **Learning:** When data comes from Google Sheets/API, always normalize to string before calling string methods (String(value ?? '')).

---

## Resolution (Red screen / toLowerCase - 2026-03-01)
**Root Cause:** API/Sheets can return non-string (e.g. number) for name/category; calling .toLowerCase() or .trim() on non-string throws.
**Solution:** Use String(value ?? '') before .toLowerCase(), .trim(), .localeCompare(), and for display (e.g. item.name[0] → String(item.name ?? '').charAt(0)).
**Resolved By:** Toh Fix Agent
**Time to Resolve:** 1 session
