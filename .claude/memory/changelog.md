# 📝 Session Changelog

> Track what changed in each work session for continuity
> **Update:** After completing any task

---

## [Session 2026-03-03] - Custom Price Override Feature

### Changes Made
| Agent | Action | File/Component |
|-------|--------|----------------|
| Dev | Add customPrice/customPriceUnit fields | Index.html (itemForm state) |
| Dev | Create effectivePriceByItemId useMemo | Index.html (line ~815) |
| Dev | Update valueReport/costcalc to use effective price | Index.html |
| Dev | Add UI section in Item Modal | Index.html (~line 4337) |
| Dev | Add badge for custom/WAC in Items table | Index.html |
| Backend | Add ensureItemPriceColumns | Code.gs (~line 2119) |
| Backend | Update saveItem for new fields | Code.gs (~line 1238) |

### Features
- Override WAC with custom price per item
- Unit conversion: per_gram, per_kg, per_piece, per_unit
- Affects: value-report, costcalc, Items table display
- Auto-create columns in Items sheet

### Next Session TODO
- [ ] Test the feature in production

---

## [Current Session] - 2026-01-27

### Changes Made
| Agent | Action | File/Component |
|-------|--------|----------------|
| - | - | - |

### Next Session TODO
- [ ] Continue from: [last task]

---

## Session History

(Previous sessions will be recorded here)

---
*Auto-updated by agents after each task*
