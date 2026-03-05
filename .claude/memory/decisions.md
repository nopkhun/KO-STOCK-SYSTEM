# Key Decisions

## Architecture Decisions
| Date | Decision | Reason |
|------|----------|--------|
| 2026-01-27 | Use Toh Framework | AI-Orchestration Driven Development |
| 2026-03-01 | First-load UX: Static Login Shell + Two-phase data load | Reduce time to first paint |
| 2026-03-01 | loadData uses getSystemDataBasic first, then getInventoryAndTransactions in background | Phase 2 executed; refetchData still uses full getSystemData |
| 2026-03-04 | Migrate from GAS+Sheets to Next.js 16+Supabase | Modern stack, better UX, typed, proper database |
| 2026-03-04 | 4-phase migration plan | Phase 1: Foundation, Phase 2: Feature Parity, Phase 3: LINE+Sheets, Phase 4: OCR |
| 2026-03-04 | LIFF + Web App separately | LIFF for quick ops in LINE, full web app in browser |
| 2026-03-04 | Supabase fresh project (not reusing old one) | Clean start with proper schema |
| 2026-03-04 | Tailwind v4 with CSS config | No tailwind.config.ts needed |
| 2026-03-04 | Server-side FIFO in /api/transactions | More reliable than client-driven FIFO in original GAS |
| 2026-03-04 | Google Sheets sync via Supabase webhook | Realtime sync without polling, INSERT->append, UPDATE/DELETE->changelog |
| 2026-03-04 | JWT auth for Sheets API via crypto.subtle | Edge-compatible, no external libraries needed |
| 2026-03-04 | GPT-4o Vision for OCR with regex fallback | Primary: accurate OCR with AI, Fallback: works without API key |
| 2026-03-04 | Exclude scripts/ from tsconfig | Migration script uses dotenv (not part of Next.js app build) |
| 2026-03-04 | Merge Upgrade -> main for Vercel production | Vercel deploys from main (default), all new code was on Upgrade branch causing API 307s |
| 2026-03-04 | Create users via direct SQL (not Admin API) | auth.admin.createUser() returns HTTP 500 for all users -- workaround |
| 2026-03-04 | Auth guard in dashboard layout (not middleware) | getUser() fails in Edge runtime (middleware) but works in Node.js/browser |
| 2026-03-05 | Delete app/page.tsx, let route group serve / | app/page.tsx had unconditional redirect('/login') causing infinite loop |
| 2026-03-05 | Recommended values as defaults, not stored | WAC price and min stock are computed real-time from lots/transactions, user can override |
| 2026-03-05 | Safety factor 5 days for min stock | Recommended min stock = avg daily usage × 5 (conservative buffer) |
| 2026-03-05 | OCR name_at_supplier auto-learn with ignoreDuplicates | Don't overwrite user-set supplier names when auto-populating |
| 2026-03-05 | Rename SelectItem to SelectOption in items page | Avoid naming conflict with shadcn/ui SelectItem component |

## Design Decisions
| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-04 | Orange primary (#f97316) theme | Match FoodStock brand identity |
| 2026-03-04 | Mobile-first with bottom nav + "more" sheet | Most users access from mobile |
| 2026-03-04 | Sidebar on desktop, bottom nav on mobile | Standard responsive pattern |
| 2026-03-04 | Thai UI labels, English code | Usability for Thai staff, maintainability for devs |
| 2026-03-04 | LIFF minimal layout (no sidebar) | Quick actions in LINE, not full app |

## Business Logic
| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-04 | FIFO lot-based inventory (server-side deduction) | More reliable than client-driven FIFO in original GAS |
| 2026-03-04 | Transaction editing: own within 1hr, no transfer/adjust edits | Match original GAS rules |
| 2026-03-04 | 3 roles: master > admin > viewer | Match original GAS permissions |
| 2026-03-04 | LINE commands: Thai natural language | Users type Thai (e.g., "stock", "receive") |

## Rejected Ideas
| Date | Idea | Why Rejected |
|------|------|--------------|
| 2026-03-04 | Single app for LIFF + Web | LIFF has size/UX constraints, better to separate |
| 2026-03-04 | Supabase Admin API for user creation | Returns HTTP 500 database error for all users |
| 2026-03-04 | Auth redirects in middleware (Edge runtime) | getUser() returns null in Edge, works in Node.js/browser only |

---
*Last updated: 2026-03-05*
