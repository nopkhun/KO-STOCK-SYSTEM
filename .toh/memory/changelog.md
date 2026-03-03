# 📝 Session Changelog

## [Fix] - 2026-03-03 — หลังเข้าสู่ระบบขึ้น "ยังไม่ได้ตั้งค่าระบบ" ทั้งที่ชีตมีข้อมูลครบ

### ปัญหา
- เมื่อล็อกอินเสร็จ ระบบแสดงหน้า "ยังไม่ได้ตั้งค่าระบบ" และปุ่ม "เริ่มต้นระบบ" ทั้งที่สถานะชีตแสดงว่า Units, Categories, Suppliers, Menus ฯลฯ มีชีตและมีแถวข้อมูลแล้ว

### สาเหตุ
- ใช้เฉพาะ `unitsMaster.length === 0 && categoriesMaster.length === 0` ในการตัดสินว่า "ยังไม่ได้ตั้งค่า" โดยไม่ดูสถานะจริงจาก getSetupStatus
- กรณี getSystemDataBasic โหลดครั้งแรกคืนค่าว่าง (หรือล้ม) แม้ชีตมีข้อมูล → needSetup = true → แสดงหน้า setup ผิด

### แก้ไข (Index.html)
- ใช้สถานะชีตเป็นหลัก: `setupCompleteBySheets = setupStatus.Units.rows > 1 && setupStatus.Categories.rows > 1`
- แสดงหน้า "ยังไม่ได้ตั้งค่าระบบ" เฉพาะเมื่อ `needSetup && !setupCompleteBySheets`
- ใน fetchSetupStatus success: ถ้า Units และ Categories มีแถวข้อมูลแล้ว ให้เรียก `refetchData()` เพื่อโหลดหน่วย/หมวดหมู่จริงจาก GAS แล้ว needSetup จะเป็น false

---

## [Revert] - 2026-03-03 — ยกเลิกระบบแคชและย้อนกลับก่อน 1 มี.ค.

### สรุป
- ยกเลิกการใช้ cache (MASTER_CACHE_KEY) ทั้งหมด: ไม่อ่านจาก cache ตอนโหลด, ไม่เขียน cache ใน loadData/refetchData/handleRefresh, ไม่ลบ cache ใน CRUD/clearAuth
- โหลดข้อมูล: ทุกครั้งเรียก loadData() จาก GAS (setIsLoading(true) แล้ว loadData)
- ลบ loadTimeoutRef (timeout 28s), refetchedEmptyRef และ useEffect ที่ refetch เมื่อรายการว่าง
- ลบการถือว่าโหลดไม่สมบูรณ์เมื่อ branches ว่างแต่มี units/categories
- ใช้ needSetup อย่างเดียวสำหรับหน้า setup (ลบ setupCompleteBySheets, showSetupScreen)
- ลบ refetchData() หลัง saveItem/saveBranch/saveUnit/saveCategory/saveSupplier

**ไฟล์:** Index.html

---

## [Fix] - 2026-03-03 — ปัญหาเหมือนเดิม (ไม่พบรายการ / เลือกสาขาไม่ได้)

### สาเหตุ
- ใช้ cache แม้ branches ว่าง เพราะเงื่อนไขเดิม `cache.items?.length >= 0` เป็น true เมื่อ items = []
- Refetch เมื่อรายการว่างทำแค่ครั้งเดียว ถ้า GAS ล้มหรือช้า จะไม่ retry

### แก้ไข
- ใช้ cache เฉพาะเมื่อ `cacheHasSetup && cache.branches?.length > 0` (ต้องมีสาขาอย่างน้อย 1 สาขา) → ไม่โชว์หน้าหลักแบบเลือกสาขาไม่ได้
- เมื่อ itemsMaster ว่างและ inventoryLoaded: เรียก refetchData() ทันที และตั้ง timeout 5 วินาที เรียก refetchData() อีกครั้ง (retry)

---

## [Plan Execution] - 2026-03-03 — แก้ระบบโหลดข้อมูล (development-plan-data-loading)

### สรุป
- **Phase 1:** refetchData และ handleRefresh ใน success handler เขียน MASTER_CACHE_KEY ด้วยข้อมูลล่าสุด (items, branches, units, categories, suppliers, itemSuppliers, menus, menuIngredients, menuOverheads) เพื่อให้เปิดครั้งถัดไปหรือโหลดจาก cache ได้ข้อมูลตรงกับชีต
- **Phase 2:** หลัง success ของ saveItem, saveBranch, saveUnit, saveCategory, saveSupplier, saveItemSupplier, saveMenu, deleteMenu, deleteUnit, deleteCategory, deleteSupplier, deleteItem, deleteBranch, deleteItemSupplier เรียก sessionStorage.removeItem(MASTER_CACHE_KEY) เพื่อไม่ให้ใช้ cache เก่า
- **Phase 3:** หลัง success ของ saveItem, saveBranch, saveUnit, saveCategory, saveSupplier เรียก refetchData() เพื่อดึงข้อมูลล่าสุดจากชีตและอัปเดต cache — รายการที่บันทึกใหม่จะแสดงครบ

**File:** Index.html

---

## [Debug Session] - 2026-02-07

### 🐛 Issue: เลือกสาขาแล้ว นำเข้า/โอน/เบิก/ปรับสต็อก ไม่ส่งผลกับคลังที่เลือก + หลังดำเนินการกลับไปคลังหลัก
**Status:** ✅ Fixed

**Cause:** ใน `refetchData` และ `handleRefresh` (และหลัง setupSheets) ใช้ `activeBranch` จาก closure เพื่อหาสาขาที่จะคงไว้ (`kept`). เมื่อ refetch ถูกเรียกจาก setInterval (ทุก 30 วินาที) หรือ visibilitychange จะได้ closure เก่า จึง `kept` เป็น undefined แล้ว `setActiveBranch(br[0])` ทำให้กลับไปสาขาแรก (คลังหลัก) เสมอ

**Fix:** ใช้ `sessionStorage.getItem(BRANCH_STORAGE_KEY)` เป็นหลักในการหาสาขาที่จะคงไว้ (เพราะมีผลกับทุกครั้งที่ผู้ใช้เปลี่ยนสาขา) แทนการพึ่ง `activeBranch` จาก closure เท่านั้น

| # | Action | Result |
|---|--------|--------|
| 1 | refetchData + handleRefresh + setupSheets success: kept = storedId ? br.find(id) : (activeBranch && br.find(id)); setActiveBranch(kept \|\| br[0]) | ✅ |

---

## [Design Session] - 2026-02-07

### /toh-design: นำเข้าสินค้า (Import modal) — Mobile-first, User-friendly
| Area | Change |
|------|--------|
| Header | Step hint: "เลือกสินค้า → กรอกจำนวนและราคา → กดเพิ่ม → ยืนยัน"; font-semibold |
| Search | Label font-medium; input border + focus:border; clear button 44px touch + aria-label |
| Product list | Rows min-h-[48px]; font-medium; truncate name on narrow |
| คู่ค้า / วันหมดอายุ | border border-slate-200; rounded-xl; focus ring; text-base |
| จำนวน / หน่วย / ราคา | inputMode decimal; min-h-52px; border + focus; font-semibold; label font-medium |
| ปุ่มเพิ่ม | full-width on mobile (flex-col); active:bg-orange-700; transition-colors |
| Bulk list | Empty state: "เลือกสินค้าด้านบน กรอกจำนวนและราคา แล้วกด เพิ่ม"; border; items break-words on mobile |
| Total box | rounded-xl; font-semibold; border-orange-200 |
| วันที่ / หมายเหตุ | label font-medium; input border + rounded-xl; textarea resize-none |
| Submit | disabled when modalType==='in' && bulkItems.length===0; transition-colors; active state; rounded-xl |

### /toh-design: ตรวจนับสต็อกจริง — Mobile-first, User-friendly
| Area | Change |
|------|--------|
| Hero | รองรับมือถือ: ขนาดหัวข้อเล็กลง (text-xl md:text-2xl), คำอธิบายชัด + บรรทัดขั้นตอน "ค้นหาสินค้า → กรอกจำนวน → บันทึกและปรับยอด" |
| Search | Label "ค้นหาสินค้า", placeholder "พิมพ์ชื่อสินค้าหรือหมวดหมู่...", ปุ่มล้างคำค้น min 44px touch target, sticky bar พร้อม border บนมือถือ |
| Desktop table | ปรับ typography (font-medium/semibold), spacing (py-4), empty state ข้อความ "ไม่มีรายการสินค้าในสาขานี้", ปุ่มบันทึก transition-colors |
| Mobile cards | Label "จำนวนนับจริง (หน่วย)" เหนือ input, input min-h-56px + inputMode="decimal", font-semibold แทน font-black, ระยะห่าง card space-y-3 |
| Empty state | ไอคอน ClipboardCheck, ข้อความชัด, ปุ่ม "ล้างคำค้น" เมื่อมีคำค้น |
| Submit (mobile) | Sticky bottom พร้อม gradient fade, min-h-56px, active:bg-emerald-800, transition-colors |

---

## [Test Session] - 2026-02-07

### /toh-test: นำเข้า โอน เบิก นับสต็อก Dashboard
| Item | Result |
|------|--------|
| Logic tests (Node) | Added `tests/logic.test.js`: FIFO deduction (full/partial/multi-lot/insufficient), parseThaiDate — **9/9 passed** |
| Manual test plan | Added `tests/MANUAL-TEST-PLAN.md`: checklist สำหรับ Dashboard, นำเข้า, โอน, เบิกออก, ตรวจนับสต็อกจริง |
| Backend fix (existing) | `matchLotId` in Code.gs รับทั้ง lotId และ id — การเบิกออกอัปเดต Inventory ถูกต้อง |

---

## [Current Session] - 2026-02-01

### UX Redesign: หน้าหลัก + นำเข้า + โอน + นับสต็อก (พนักงานหน้าร้าน + Mobile)
| Component | Change |
|-----------|--------|
| Dashboard | Quick Actions block 3 ปุ่มใหญ่ (นำเข้า, โอน, นับสต็อก) พร้อมคำอธิบายง่าย |
| Dashboard | บัตรสรุป (สินค้าใกล้หมด, รายการวันนี้) ปรับ layout |
| Dashboard | ตารางยอดสต็อก + Mobile card layout; ค้นหาสินค้า; แสดงเฉพาะใกล้หมด |
| Modals | นำเข้า: Search สินค้า แทน dropdown; คู่ค้า + วันหมดอายุ; จำนวน + ราคา/หน่วย; รายการที่เพิ่มแล้ว |
| Modals | โอน/เบิก: Search สินค้า แสดงสต็อกคงเหลือ; Search สาขา (โอน); input จำนวนใหญ่ |
| Stock Take | Search bar sticky; Desktop: ตาราง; Mobile: Card layout; input นับจริง min-h-52px; ปุ่มบันทึก sticky |
| Global | Viewport meta; font 16px บนมือถือ (ป้องกัน iOS zoom); ปุ่ม min-h-48px |

### Plan Completed
- [x] Phase 1: Dashboard redesign
- [x] Phase 2: Import + Transfer modals (Search, Mobile)
- [x] Phase 3: Stock Take (Search, Cards)
- [x] Phase 4: Design polish

### Cost Calculator: ต้นทุนอาหาร + เมนู (2026-02-02)
| Component | Change |
|-----------|--------|
| Cost Calc Tab | เพิ่มแท็บ **ต้นทุนอาหาร**: เลือกวัตถุดิบจากระบบ (WAC) หรือกรอกเอง, ต้นทุนแฝง (%/บาท), สรุปต้นทุนรวม, ราคาขายแนะนำหน้าร้าน + ออนไลน์ (GP 30%) |
| Cost Calc Tab | ใส่ **ต้นทุนแฝง default** (ค่าแรง/ค่าไฟ/บรรจุภัณฑ์/ค่าเช่า/อื่นๆ) + ปุ่ม “คืนค่า default” |
| Cost Calc Tab | เพิ่มการ **บันทึกเป็นเมนู**: เลือกเมนูที่บันทึกไว้, บันทึก/บันทึกเป็นเมนูใหม่, ลบ, ล้างฟอร์ม |
| Backend | เพิ่ม Sheets: Menus, MenuIngredients, MenuOverheads + GAS endpoints saveMenu/deleteMenu + ส่งข้อมูลกลับใน getSystemData |

### Mobile UX: เมนู + สาขา + การใส่ข้อมูล (2026-02-02)
| Component | Change |
|-----------|--------|
| Sidebar | บนมือถือ: drawer (ซ่อนโดยค่าเริ่มต้น), เปิดด้วยปุ่ม hamburger (Menu icon), overlay คลิกปิด, ปุ่ม X ปิด; เลือกเมนูหรือสาขาแล้วปิด drawer อัตโนมัติ |
| Main | Sticky branch bar (มือถือเท่านั้น): แสดง "กำลังทำงานที่ [ชื่อสาขา]" แตะเปิด drawer เพื่อเปลี่ยนสาขา |
| Inputs | บนมือถือ: input/select/textarea min-height 48px (CSS); ปุ่มเมนูและสาขาใช้ touch-target (min-h 48px) |
| URL | เพิ่ม costcalc ใน VALID_TABS สำหรับ deep link ?tab=costcalc |

---

## [Debug Session] - 2026-03-03 (3)

### 🐛 Issue: ระหว่างรอโหลดข้อมูล พอหยุดโหลดแล้วเลือกสาขาไม่ได้ และขึ้นว่าไม่พบรายการ
**Status:** ✅ Fixed

**Cause:** (1) เมื่อ getSystemDataBasic คืนค่าสำเร็จแต่ branches ว่าง (มีแค่ units/categories) ระบบยังตั้ง state แล้วโชว์หน้าหลัก → activeBranch = null, branchesMaster = [] จึงเลือกสาขาไม่ได้ และ items ว่าง → "ไม่พบรายการ". (2) เมื่อ GAS ค้าง/ timeout ฝั่ง server ไม่ตอบ หน้าจะรอโหลดตลอด

**Fix:** (1) ใน loadData success: ถ้า branches.length === 0 และมี units หรือ categories ให้ถือว่าโหลดไม่สมบูรณ์ → setDataLoadFailed(true), setIsLoading(false), return (ไม่อัปเดต state ไม่เรียก getInventoryAndTransactions) เพื่อโชว์หน้า "โหลดข้อมูลไม่สำเร็จ" และปุ่ม "ลองใหม่". (2) เพิ่ม timeout ฝั่ง client 28 วินาที — หลัง 28 วินาทีถ้ายังไม่ได้รับ success/failure ให้ setDataLoadFailed และ setIsLoading(false). ล้าง timeout ใน success, failure และ catch.

| # | Action | Result |
|---|--------|--------|
| 1 | loadData success: ถ้า branches ว่างแต่มี units/categories → dataLoadFailed + return | ✅ |
| 2 | loadTimeoutRef + setTimeout 28s; clear ใน success/failure/catch | ✅ |

---

## [Debug Session] - 2026-03-03 (2)

### 🐛 Issue: แดชบอร์ดไม่พบรายการใดที่เคยบันทึกไว้ (ยอดสต็อกคงเหลือ แสดง "ไม่พบรายการ")
**Status:** ✅ Fixed

**Cause:** (1) เมื่อโหลดจาก cache ไม่ได้ set inventoryLoaded = true จึงตารางอาจค้างโหมด skeleton หรือ state ไม่สอดคล้อง. (2) เมื่อเข้าได้ด้วย setupCompleteBySheets หรือ cache ที่ items ว่าง จะได้ itemsMaster = [] จึง currentBranchInventory ว่าง → แสดง "ไม่พบรายการ" และไม่มีโอกาสโหลดใหม่

**Fix:** (1) เมื่อใช้ cache ให้ setInventoryLoaded(true) ด้วย. (2) เมื่อ token + inventoryLoaded เป็น true และ itemsMaster.length === 0 ให้ refetchData() อีกครั้ง (ใช้ useRef refetchedEmptyRef เพื่อเรียกครั้งเดียวต่อ session)

| # | Action | Result |
|---|--------|--------|
| 1 | Cache: setInventoryLoaded(true) เมื่อ fromCache | ✅ |
| 2 | useEffect: token && inventoryLoaded && itemsMaster.length===0 → refetchData() ครั้งเดียว (refetchedEmptyRef) | ✅ |

---

## [Debug Session] - 2026-03-03

### 🐛 Issue: หลังเข้าสู่ระบบแล้วขึ้น "ยังไม่ได้ตั้งค่าระบบ" แม้สถานะชีตแสดงว่ามีชีตและมีข้อมูล
**Status:** ✅ Fixed

**Cause:** (1) โหลดจาก cache เมื่อมี branches/items แต่ cache อาจมี units/categories ว่าง (จาก session เก่า) จึงไม่เรียก loadData() และ state ยังเป็น [] → needSetup เป็น true. (2) เมื่อ needSetup เป็น true ระบบจะโหลด getSetupStatus ซึ่งอ่านจากชีตจริง จึงแสดง "มีชีต (14 แถว)" แต่หน่วย/หมวดหมู่ใน state ยังว่าง

**Fix:** (1) ใช้ cache ข้าม loadData() เฉพาะเมื่อ cache มีทั้ง units และ categories ไม่ว่าง (cacheHasSetup). (2) เมื่อ getSetupStatus คืนค่าแล้วและ Units.rows > 1 และ Categories.rows > 1 ให้เรียก refetchData() และ setIsSettingUp(false). (3) **รอบ 2:** ใช้สถานะชีตเป็นหลัก — ถ้า setupStatus บอกว่า Units/Categories มีแถวข้อมูลแล้ว ให้ไม่แสดงหน้า setup เลย (showSetupScreen = needSetup && !setupCompleteBySheets). (4) handleSetup: เพิ่ม timeout 45 วินาที เพื่อยกเลิก "กำลังตั้งค่า..." ถ้า setupSheets ค้าง

| # | Action | Result |
|---|--------|--------|
| 1 | Cache: ใช้ cache และข้าม loadData เมื่อ cache.units?.length > 0 && cache.categories?.length > 0 | ✅ |
| 2 | fetchSetupStatus success: ถ้า status แสดง Units/Categories มีข้อมูล ให้ refetchData() + setIsSettingUp(false) | ✅ |
| 3 | showSetupScreen = needSetup && !setupCompleteBySheets; ใช้ showSetupScreen แทน needSetup สำหรับ return หน้า setup | ✅ |
| 4 | handleSetup: clearTimeout ใน success/failure; setTimeout 45s ปลด isSettingUp | ✅ |

---

## [Debug Session] - 2026-02-02

### 🐛 Issue: Still shows "ยังไม่ได้ตั้งค่าระบบ"
**Status:** ✅ Resolved (see 2026-03-03 session)

| # | Agent | Hypothesis | Action | Result |
|---|-------|------------|--------|--------|
| 1 | Codex | Units/Categories missing or empty; need visibility | Added `getSetupStatus` + setup status panel | ⏳ Pending |
| 2 | Codex | getSystemData likely returning empty due to exception | Added `_debug` fields + show on setup screen | ⏳ Pending |
| 3 | Codex | Debug line missing; likely not deployed | Instruct deploy + hard refresh | ⏳ Pending |

## [Previous Session] - 2026-01-27

### Changes Made
| Agent | Action | File/Component |
|-------|--------|----------------|
| Plan | Added UI phase: Mobile First, Responsive, User Friendly | Development plan |
| Plan | Updated active, decisions, changelog | .toh/memory/ |
| Backend | Added `saveItem`, `saveBranch`, `saveUnit`, `saveCategory`, `deleteItem`, `deleteBranch`, `deleteUnit`, `deleteCategory` | Code.gs |
| UI + Dev | Tabs รายการสินค้า, สาขา, หน่วย, หมวดหมู่; add/edit/delete modals; refetchData, handlers | Index.html |
| Fix | Fixed branch name not displaying - normalize Sheet headers (case-insensitive) | Code.gs |
| Performance | Optimized: No refetch after CRUD, optimistic delete, toast notifications | Index.html |
| Phase 2 | History filters: date range, branch, item, type filters with real-time filtering | Index.html |
| Phase 2 | Error handling: Toast notifications (success/error), retry logic, better error messages | Index.html |
| Phase 2 | UI polish: Improved history table, empty states, responsive filters | Index.html |

### Next Session TODO
- [ ] Execute development-plan-suppliers-pricing (Phase 1–5) when user says "Go"

### Plan: คู่ค้า + ราคา + WAC + รายงาน (2026-01-27)
- [x] Phase 1: Suppliers CRUD, แทน SUPPLIERS ในรับสินค้า (Code.gs + Index.html)
- [x] Phase 2: ItemSuppliers (ชื่อที่คู่ค้า), UI ในรายการสินค้า — แก้ไขสินค้า → ซื้อได้ที่คู่ค้า, โมดัลเพิ่ม/แก้ไข
- [x] Phase 3: ราคาตอนนำเข้า — Inventory/Transactions unitPrice,totalPrice; โมดัลรับสินค้า ราคา/หน่วย + ยอดรวม ต่อรายการ
- [x] Phase 4: WAC — wacByItemId useMemo; แสดงต้นทุนเฉลี่ยในรายการสินค้า + รายงาน + CSV
- [x] Phase 5: รายงานราคาซื้อ — กรองช่วงวันที่/สินค้า/คู่ค้า, ตาราง, ส่งออก CSV

### Phase 19 (Reports Sort & Search Clear)
- [x] reportSortBy (name | totalQty | lowStockFirst), sortedReportStock; จำ reportSortBy
- [x] ปุ่ม ล้าง ช่องค้นหาสต็อกในรายงาน; CSV ใช้ sortedReportStock

### Phase 18 (Duplicate Units & Categories)
- [x] openUnitModalAsCopy(u), openCategoryModalAsCopy(c) → ชื่อ (สำเนา), id ว่าง
- [x] ปุ่มคัดลอก (Copy) ใน Units + Categories แท็บ (table + mobile)

### Phase 17 (Confirm Modal & Search Clear)
- [x] Confirm modal: state, showConfirm(), ยกเลิก/ยืนยัน, Escape ปิด
- [x] แทน confirm() ใน handleDeleteUnit, handleDeleteCategory, handleDeleteItem, handleDeleteBranch, submitStockTake
- [x] Dashboard ค้นหาวัตถุดิบ: ปุ่ม ล้าง เมื่อมีคำค้น, input controlled (value=searchTerm)

### Phase 16 (Inventory Sort)
- [x] inventorySortBy (name | totalQty | lowStockFirst), sortedInventoryForDisplay
- [x] Dropdown เรียงตาม ใน Dashboard + Inventory; จำใน SORT_PREFS

### Phase 15 (Persist & History Sort)
- [x] จำ inventoryLowStockOnly (sessionStorage), restore ตอนโหลด
- [x] History: เรียงตาม ล่าสุดก่อน | เก่าสุดก่อน, sortedHistoryTransactions; CSV ใช้ลำดับเดียวกัน; จำ historySortOrder

### Phase 14 (Sort Persist & Units/Categories Sort)
- [x] Persist sort: itemsSortBy, branchesSortBy, unitsSortOrder, categoriesSortOrder (sessionStorage)
- [x] หน่วย: เรียงตาม ชื่อ A–Z / Z–A, sortedUnits
- [x] หมวดหมู่: เรียงตาม ชื่อ A–Z / Z–A, sortedCategories

### Phase 13 (Sort)
- [x] Items: dropdown เรียงตาม ชื่อ / หมวดหมู่ / ขั้นต่ำ, sortedItems
- [x] Branches: dropdown เรียงตาม ชื่อ / Stock Center ก่อน, sortedBranches

### Phase 12 (Toast & Duplicate Branch)
- [x] แทน alert() ด้วย showError() ใน validation ฟอร์ม (สินค้า, สาขา, หน่วย, หมวดหมู่)
- [x] คัดลอกสาขา: ปุ่ม Copy, openBranchModalAsCopy → ชื่อ (สำเนา), isHQ false

### Phase 11 (Deep link & Duplicate)
- [x] Deep link ?tab=: init activeTab from URL, sync URL on tab change (replaceState)
- [x] คัดลอกสินค้า: ปุ่ม Copy, openItemModalAsCopy → ชื่อ (สำเนา), บันทึกเป็นใหม่

### Phase 10 (Persist & Skeleton)
- [x] จำ Report filters (sessionStorage): reportDateFrom, reportDateTo, reportSearchTerm; save on change, restore on load
- [x] Loading skeleton: โครง sidebar + main แทน spinner, placeholders animate-pulse

### Phase 9 (Persist & Filter)
- [x] จำ History filters (sessionStorage): save on change, restore on load
- [x] แสดงเฉพาะสินค้าใกล้หมด: toggle ใน Dashboard + Inventory; คลิกการ์ดสินค้าใกล้หมด → ไปคลัง + เปิด filter; empty state

### Phase 8 (Persist & Today)
- [x] จำสาขาที่เลือก (sessionStorage): บันทึก id ตอนเปลี่ยนสาขา, restore ตอนโหลดถ้าสาขายังมี
- [x] Dashboard "รายการเคลื่อนไหววันนี้": parseThaiDate + isToday แทน toLocaleDateString

### Phase 7 (Search & Clear)
- [x] ปุ่ม "ล้าง" ค้นหา รายการสินค้า + สาขา (เมื่อมีคำค้น)
- [x] หน่วย: ค้นหา (ชื่อหน่วย) + ล้าง + filteredUnits + empty state
- [x] หมวดหมู่: ค้นหา (ชื่อหมวดหมู่) + ล้าง + filteredCategories + empty state

### Phase 6 (UX)
- [x] Escape ปิด modal (ไม่ปิดตอน isSaving)
- [x] Items tab ค้นหา (ชื่อ, หมวดหมู่, หน่วย), filteredItems, empty state
- [x] Branches tab ค้นหา (ชื่อสาขา), filteredBranches, empty state

### Phase 5 (Reports & Print)
- [x] รายงาน ช่วงวันที่ (ตั้งแต่/ถึง), สรุปประวัติตามช่วง, ส่งออก CSV ประวัติ
- [x] ค้นหาสต็อกในรายงาน, ส่งออก CSV ใช้รายการที่ filter
- [x] ปุ่มพิมพ์ History + Reports, no-print, @media print

### Phase 4 (UX & Setup)
- [x] ปุ่มรีเฟรชใน header, handleRefresh + isRefreshing
- [x] First-run Setup UI (needSetup), handleSetup → setupSheets → refetch
- [x] Dashboard การ์ดสินค้าใกล้หมด / รายการเคลื่อนไหววันนี้ คลิกไป inventory / history

### Phase 3 (Reports & Export)
- [x] Tab "รายงาน", stock summary table, history summary cards
- [x] `downloadCSV` helper, Export CSV (History + Reports)
- [x] Download icon, nav/header for reports

---
*Auto-updated by agents after each task*
