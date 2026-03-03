# แผนแก้ไขระบบโหลดข้อมูล — แสดงรายการที่บันทึกใหม่ให้สมบูรณ์

> สร้างจาก /toh-plan (2026-03-03)

---

## 🎯 Analysis Summary

**Request:** แก้ไขระบบโหลดข้อมูลที่ยังมี Bug ในการไม่แสดงผลรายการที่มีการบันทึกใหม่ทั้งหมดให้สมบูรณ์

**บริบทจาก Memory:**
- โครงสร้าง: GAS (Code.gs) + Google Sheets + React SPA (Index.html)
- โหลดข้อมูล: `loadData()` → getSystemDataBasic → getInventoryAndTransactions; `refetchData()` → getSystemData (เต็ม)
- มี cache (MASTER_CACHE_KEY) เมื่อ units+categories ไม่ว่าง; polling 30s + visibility → refetchData
- ปัญหาที่แก้ไปแล้ว: หน้า setup ค้าง, แดชบอร์ดไม่พบรายการ, โหลดไม่สมบูรณ์เมื่อ branches ว่าง, timeout 28s

**สาเหตุที่เป็นไปได้ที่ "รายการบันทึกใหม่ไม่แสดงสมบูรณ์":**
1. **Cache เก่า** — หลังเพิ่ม/แก้รายการ (สินค้า, สาขา, หน่วย, หมวดหมู่, คู่ค้า) ไม่ได้ลบหรืออัปเดต cache → เปิดใหม่หรือโหลดจาก cache ได้ข้อมูลเก่า
2. **ไม่มี refetch หลัง CRUD บางตัว** — รายการสินค้า/สาขา/หน่วย/หมวดหมู่/คู่ค้า ใช้แค่ optimistic update (setState จาก response); ถ้า backend คืนค่าไม่ตรงหรือไม่ครบ จะไม่ตรงกับชีต
3. **การอัปเดต cache มีแค่ใน loadData success** — ไม่มีการเขียน cache หลัง refetchData หรือหลัง save → สถานะ "ความจริง" อยู่ที่ชีตแต่ cache ไม่ได้อัปเดต

**Business Type:** F&B Inventory (KO-Stock-System)  
**Complexity:** Medium  
**Estimated Time:** ประมาณ 15–25 นาที

---

## 📊 Phase Breakdown

| Phase | Focus | Type | Dependencies | Est. Time |
|-------|--------|------|--------------|-----------|
| 1 | Audit + อัปเดต cache หลัง refetch | Fix | None | 5 min |
| 2 | ลบ/อัปเดต cache หลัง CRUD ทุกจุด | Fix | Phase 1 | 5 min |
| 3 | เลือก: refetch หลัง save หรือให้ optimistic ครบ + ทดสอบ | Fix + Verify | Phase 2 | 5–10 min |

---

## 🤖 Agent Assignments

### Phase 1: ให้ refetch อัปเดต cache และใช้ข้อมูลจากชีตเป็นหลัก
| Agent | Task | Output |
|-------|------|--------|
| ⚙️ Dev/Fix | ใน refetchData และ handleRefresh success หลัง set state ทั้งหมด ให้เขียน MASTER_CACHE_KEY ด้วยข้อมูลชุดล่าสุด (items, branches, units, categories, suppliers, itemSuppliers, menus, menuIngredients, menuOverheads) | Index.html — โค้ดเดียวกับที่ loadData เขียน cache แต่เรียกจาก refetch/handleRefresh |

**เหตุผล:** ตอนนี้ cache ถูกเขียนแค่ใน loadData success; refetchData/handleRefresh อัปเดต state แต่ไม่เขียน cache จึงเปิดครั้งถัดไปอาจได้ cache เก่า

---

### Phase 2: ลบหรืออัปเดต cache ทุกครั้งที่มีการบันทึก (CRUD)
| Agent | Task | Output |
|-------|------|--------|
| ⚙️ Dev/Fix | หลัง success ของ saveItem, saveBranch, saveUnit, saveCategory, saveSupplier, saveItemSupplier, saveMenu, deleteMenu (และ delete อื่นที่กระทบ list) ให้ลบ MASTER_CACHE_KEY (sessionStorage.removeItem) หรืออัปเดต cache จาก state ปัจจุบัน | Index.html — เพิ่ม 1–2 บรรทัดในแต่ละ success handler ที่เกี่ยวข้อง |

**เหตุผล:** ถ้าไม่แตะ cache หลัง save การโหลดรอบถัดไป (หรือการใช้ cache ใน session เดียวกัน) อาจได้ข้อมูลก่อนบันทึก

---

### Phase 3: ให้รายการที่บันทึกใหม่แสดงครบ (refetch หลัง save หรือทำให้ optimistic ถูกต้อง)
| Agent | Task | Output |
|-------|------|--------|
| ⚙️ Dev/Fix | (ตัวเลือก A) หลัง success ของ saveItem, saveBranch, saveUnit, saveCategory, saveSupplier เรียก refetchData() เพื่อดึงข้อมูลล่าสุดจากชีต (แสดงรายการบันทึกใหม่สมบูรณ์) หรือ (ตัวเลือก B) ตรวจว่า backend คืนค่าชื่อฟิลด์ตรงกับที่ใช้ใน list ไหม ถ้าไม่ตรงให้แก้ optimistic update ให้ใช้ response จริง แล้วเก็บการ invalidate cache จาก Phase 2 | Index.html (+ Code.gs ถ้าเลือก B และต้องแก้ response) |

**เหตุผล:** ตอนนี้บาง flow ใช้แค่ optimistic update; ถ้า GAS คืนค่าไม่ครบหรือ shape ต่าง จะทำให้รายการที่เพิ่งบันทึกไม่แสดงหรือแสดงผิด

---

## 🔄 Execution Flow

```
[ Phase 1: refetch/handleRefresh เขียน cache ]
        ↓
[ Phase 2: CRUD success → invalidate/update cache ]
        ↓
[ Phase 3: refetch หลัง save หรือแก้ optimistic ]
```

---

## ⏱️ Total: 3 phases, ~15–25 นาที

---
## ✅ Execution Complete (2026-03-03)

| Phase | Status | Changes |
|-------|--------|--------|
| 1 | ✅ | refetchData + handleRefresh success เขียน MASTER_CACHE_KEY (items, branches, units, categories, suppliers, itemSuppliers, menus, menuIngredients, menuOverheads) |
| 2 | ✅ | ทุก CRUD success (saveItem, saveBranch, saveUnit, saveCategory, saveSupplier, saveItemSupplier, saveMenu, deleteMenu, deleteUnit/Category/Supplier/Item/Branch/ItemSupplier) เรียก sessionStorage.removeItem(MASTER_CACHE_KEY) |
| 3 | ✅ | หลัง saveItem, saveBranch, saveUnit, saveCategory, saveSupplier success เรียก refetchData() เพื่อดึงข้อมูลล่าสุดจากชีต |

**Files modified:** Index.html
