# แผนยกเลิกระบบแคช และย้อนกลับก่อนการแก้ไขต้นมีนาคม

> ดำเนินการจาก /toh-plan (2026-03-03)

---

## สรุปการดำเนินการ

### 1. ยกเลิกระบบแคชทั้งหมด
- ลบ constant `MASTER_CACHE_KEY` และการอ้างอิงทั้งหมด
- ลบการอ่าน cache ตอนโหลด (useEffect ที่อ่านจาก sessionStorage แล้ว set state + fromCache) → แทนที่ด้วยโหลดจาก GAS เท่านั้น: `setIsLoading(true); loadData();`
- ลบการเขียน cache ใน loadData success
- ลบการเขียน cache ใน refetchData และ handleRefresh success
- ลบการลบ cache ใน clearAuth
- ลบ `sessionStorage.removeItem(MASTER_CACHE_KEY)` ในทุก CRUD success (saveItem, saveBranch, saveUnit, saveCategory, saveSupplier, saveItemSupplier, saveMenu, deleteMenu, deleteUnit/Category/Supplier/Item/Branch/ItemSupplier)

### 2. ยกเลิก workaround ต้นมีนาคม
- ลบ loadTimeoutRef และ timeout 28 วินาที ใน loadData
- ลบ refetchedEmptyRef และ useEffect ที่ refetch เมื่อ items ว่าง (และ retry 5 วินาที)
- ลบการถือว่าโหลดไม่สมบูรณ์เมื่อ branches ว่างแต่มี units/categories (ใน loadData success)
- ใช้ needSetup อย่างเดียวสำหรับหน้า setup (ลบ setupCompleteBySheets และ showSetupScreen)
- ใน fetchSetupStatus success: ลบการเรียก refetchData() และ setIsSettingUp(false) เมื่อชีตมีข้อมูล

### 3. ย้อนกลับการ refetch หลัง save
- ลบ refetchData() หลัง success ของ saveItem, saveBranch, saveUnit, saveCategory, saveSupplier (คงเฉพาะ optimistic update)

---

## สิ่งที่ยังคงไว้ (ก่อนมีนาคม)
- เก็บ BRANCH_STORAGE_KEY และการคงสาขาที่เลือก (sessionStorage) หลัง refetch/handleRefresh/setupSheets
- เก็บ polling 30 วินาที และ visibility refetch
- เก็บการแสดง getSetupStatus บนหน้า setup และปุ่มรีเฟรชสถานะ
- เก็บ handleSetup และ setupSheets

---

**ไฟล์ที่แก้:** Index.html เท่านั้น
