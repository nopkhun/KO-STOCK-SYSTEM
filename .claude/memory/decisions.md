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
| 2026-03-04 | Google Sheets sync via Supabase webhook | Realtime sync without polling, INSERT→append, UPDATE/DELETE→changelog |
| 2026-03-04 | JWT auth for Sheets API via crypto.subtle | Edge-compatible, no external libraries needed |
| 2026-03-04 | GPT-4o Vision for OCR with regex fallback | Primary: accurate OCR with AI, Fallback: works without API key |
| 2026-03-04 | Exclude scripts/ from tsconfig | Migration script uses dotenv (not part of Next.js app build) |

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
| 2026-03-04 | LINE commands: Thai natural language | Users type Thai (e.g., "สต็อก", "รับเข้า") |

## Rejected Ideas
| Date | Idea | Why Rejected |
|------|------|--------------|
| 2026-03-04 | Single app for LIFF + Web | LIFF has size/UX constraints, better to separate |

---
*Last updated: 2026-03-04*
