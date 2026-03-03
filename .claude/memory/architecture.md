# 🏗️ Project Architecture

> Semantic overview of project structure for AI context loading
> **Update:** After any structural changes (new pages, routes, modules, services)

---

## 📁 Entry Points

| Type | Path | Purpose |
|------|------|---------|
| Main | `app/page.tsx` | Landing/Home page |
| Layout | `app/layout.tsx` | Root layout with providers |
| API | `app/api/` | API routes (if any) |

---

## 🗂️ Core Modules

### `/app` - Pages & Routes

| Route | File | Description | Key Functions |
|-------|------|-------------|---------------|
| `/` | `app/page.tsx` | Landing page | - |

### `/components` - UI Components

| Folder | Purpose | Key Files |
|--------|---------|-----------|
| `ui/` | shadcn/ui components | button, card, input, etc. |
| `layout/` | Layout components | Navbar, Sidebar, Footer |
| `features/` | Feature-specific | Per feature components |

### `/lib` - Utilities & Services

| File | Purpose | Key Functions |
|------|---------|---------------|
| `lib/utils.ts` | Utility functions | cn(), formatDate() |

---

## 🔄 Data Flow Pattern

User Action → Component → Zustand Store → API/Lib → Database (Supabase)

---

## 🔌 External Services

| Service | Purpose | Config Location |
|---------|---------|-----------------|
| Supabase | Backend (Auth, DB) | `lib/supabase/` |

---

## 📝 Notes

- Using Toh Framework v1.8.1
- Architecture tracking enabled

---
*Last updated: 2026-01-27*
