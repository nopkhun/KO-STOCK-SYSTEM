# Plan: ปรับปรุงฟีเจอร์หน้ารายการสินค้า + รายงาน

## สรุปสิ่งที่มีอยู่แล้ว (Baseline)

| สิ่งที่มี | รายละเอียด |
|-----------|-----------|
| **items table** | มี `custom_price`, `custom_price_unit`, `min_stock` |
| **item_suppliers table** | Junction table มี `name_at_supplier` แต่ยังไม่มี UI จัดการ |
| **inventory table** | FIFO lots มี `unit_price`, `supplier_id` ในแต่ละ lot |
| **transactions table** | มี `unit_price`, `supplier_id` ทุก stock-in transaction |
| **OCR system** | มี fuzzy matching แต่ยังไม่ใช้ `name_at_supplier` |
| **Value report** | ใช้ WAC จาก FIFO lots อยู่แล้ว (ใช้ `unit_price` จริง ไม่ใช่ `custom_price`) |

---

## ฟีเจอร์ 1: ราคาแนะนำ (Recommended Price) ในหน้ารายการสินค้า

### ไฟล์ที่ต้องแก้ไข
- `app/(dashboard)/items/page.tsx` - เพิ่ม UI ราคาแนะนำ + ปรับฟอร์ม
- `stores/inventory.ts` หรือ items page ดึง inventory lots โดยตรง

### รายละเอียดการเปลี่ยนแปลง

1. **Items page: ดึง inventory lots เพื่อคำนวณ WAC ต่อ item**
   - ใน `items/page.tsx` เพิ่ม `useInventoryStore` เพื่อ fetch lots
   - สร้าง `useMemo` สำหรับ `recommendedPrices: Map<itemId, wacPrice>`
   - คำนวณจาก `calculateWAC()` (จาก `lib/utils/fifo.ts`) ของ lots ที่ `remaining_qty > 0`

2. **Desktop Table: เพิ่มคอลัมน์ "ราคาแนะนำ (WAC)"**
   ```
   <th>ราคาแนะนำ</th>
   ```
   - แสดง WAC price ถ้ามี lots อยู่
   - แสดง "-" ถ้าไม่มีข้อมูล

3. **Mobile Cards: แสดง recommended price**
   - เพิ่ม `<span>แนะนำ: {wac} บาท</span>` ใน info row

4. **ฟอร์มเพิ่ม/แก้ไข: แสดง recommended price เป็น hint**
   - ใต้ input "ราคากำหนดเอง" แสดงข้อความ:
     `"ราคาแนะนำ (WAC): {wac} บาท/หน่วย"` ถ้ามีข้อมูล
   - placeholder ของ input ใช้ค่า WAC แทน "ไม่ระบุ"
   - ถ้า user ไม่กรอก → ใช้ recommended price

5. **handleSave: ปรับ logic**
   ```ts
   custom_price: form.custom_price
     ? Number(form.custom_price)
     : recommendedPrice || null
   ```

---

## ฟีเจอร์ 2: ชื่อเฉพาะสินค้าของแต่ละผู้จัดส่ง

### ไฟล์ที่ต้องแก้ไข
- `stores/master-data.ts` - fetch item_suppliers relation
- `app/(dashboard)/items/page.tsx` - เพิ่ม supplier names section ในฟอร์ม
- `lib/ocr.ts` - ปรับ `matchItemsToInventory()` ให้ใช้ `name_at_supplier`
- `app/api/ocr/process/route.ts` - ส่ง item_suppliers data ไปด้วย
- `app/api/ocr/confirm/route.ts` - auto-save name_at_supplier

### รายละเอียดการเปลี่ยนแปลง

1. **master-data.ts: ปรับ fetchAll() ให้ดึง item_suppliers**
   ```ts
   supabase
     .from("items")
     .select("*, unit:units(*), category:categories(*), item_suppliers(*)")
     .order("name")
   ```

2. **items/page.tsx: เพิ่ม supplier names section ในฟอร์ม**
   - เพิ่ม state: `supplierMappings: Array<{ supplier_id: string, name_at_supplier: string }>`
   - UI: section "ชื่อในระบบผู้จัดส่ง" ใต้ custom price
     - แต่ละ row: dropdown เลือก supplier + input ชื่อเฉพาะ + ปุ่มลบ
     - ปุ่ม "+ เพิ่มผู้จัดส่ง"
   - openEditDialog: load existing item_suppliers
   - handleSave: upsert item_suppliers records

3. **items table: แสดง supplier badges**
   - ในตาราง desktop/mobile แสดง badges ชื่อ suppliers ที่ผูกอยู่

4. **ocr.ts: ปรับ matchItemsToInventory()**
   - เพิ่ม parameter `itemSuppliers: Array<{ item_id, supplier_id, name_at_supplier }>`
   - เพิ่ม parameter `receiptSupplierId?: string` (supplier ที่อ่านจาก receipt)
   - Match priority:
     1. Exact match กับ `name_at_supplier` ของ supplier นั้น → score 1.0
     2. Contains match กับ `name_at_supplier` → score based on length ratio
     3. Fallback: match กับ `items.name` (เดิม)

5. **ocr/process/route.ts: ดึง item_suppliers ด้วย**
   ```ts
   const { data: items } = await supabase
     .from("items")
     .select("id, name, item_suppliers(supplier_id, name_at_supplier)");
   ```
   - ส่ง supplier match data ไปยัง matchItemsToInventory

6. **ocr/confirm/route.ts: auto-save name_at_supplier**
   - เมื่อ confirm item สำเร็จ และ parsed_name != matched_item_name:
   ```ts
   if (item.supplier_id && parsedName) {
     await supabase.from("item_suppliers").upsert({
       item_id: item.item_id,
       supplier_id: item.supplier_id,
       name_at_supplier: parsedName,
     }, { onConflict: "item_id,supplier_id" });
   }
   ```

---

## ฟีเจอร์ 3: จำนวนขั้นต่ำแนะนำจากข้อมูลการใช้ในอดีต

### ไฟล์ที่ต้องแก้ไข
- `lib/utils/stock-recommendations.ts` (ใหม่) - สร้าง function คำนวณ
- `app/(dashboard)/items/page.tsx` - เพิ่ม UI แนะนำ min stock

### รายละเอียดการเปลี่ยนแปลง

1. **สร้าง `lib/utils/stock-recommendations.ts`**
   ```ts
   interface RecommendedMinStock {
     value: number;
     avgDailyUsage: number;
     daysOfData: number;
     safetyDays: number;
   }

   export function calculateRecommendedMinStock(
     outTransactions: Array<{ amount: number; created_at: string }>,
     safetyDays: number = 5
   ): RecommendedMinStock | null {
     if (outTransactions.length === 0) return null;

     // หา date range
     const dates = outTransactions.map(t => new Date(t.created_at));
     const minDate = Math.min(...dates.map(d => d.getTime()));
     const maxDate = Math.max(...dates.map(d => d.getTime()));
     const daysOfData = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));

     // คำนวณ total usage
     const totalUsage = outTransactions.reduce((sum, t) => sum + t.amount, 0);
     const avgDailyUsage = totalUsage / daysOfData;

     return {
       value: Math.ceil(avgDailyUsage * safetyDays * 10) / 10, // round up to 1 decimal
       avgDailyUsage,
       daysOfData: Math.round(daysOfData),
       safetyDays,
     };
   }
   ```

2. **items/page.tsx: ดึง out-transactions ต่อ item**
   - Fetch transactions type='out' จาก Supabase (ย้อนหลัง 90 วัน)
   - สร้าง `recommendedMinStocks: Map<itemId, RecommendedMinStock>`

3. **Desktop Table: แสดงคอลัมน์ "ขั้นต่ำแนะนำ"**
   - หรือแสดงเป็น tooltip/hint ข้างค่า min_stock ปัจจุบัน
   - แสดง recommended value + "({avgDaily}/วัน x {safetyDays} วัน)"

4. **ฟอร์ม: แสดง recommended min_stock**
   - ใต้ input "สต็อกขั้นต่ำ" แสดง:
     `"แนะนำ: {recommended} (เฉลี่ย {daily}/วัน x 5 วัน)"`
   - ปุ่ม "ใช้ค่าแนะนำ" เพื่อ auto-fill
   - openCreateDialog: default min_stock ใช้ค่าแนะนำถ้ามี

---

## ฟีเจอร์ 4: Auto-populate item_suppliers จากประวัติ stock-in

### ไฟล์ที่ต้องแก้ไข
- `app/api/transactions/route.ts` - เพิ่ม auto-upsert item_suppliers
- `app/api/ocr/confirm/route.ts` - เพิ่ม auto-upsert item_suppliers

### รายละเอียดการเปลี่ยนแปลง

1. **transactions/route.ts: ใน type='in' section**
   - หลัง insert lot สำเร็จ และก่อน audit log:
   ```ts
   // Auto-populate item_suppliers when supplier is provided
   if (supplier_id) {
     await supabase
       .from("item_suppliers")
       .upsert(
         { item_id, supplier_id, name_at_supplier: "" },
         { onConflict: "item_id,supplier_id", ignoreDuplicates: true }
       );
   }
   ```

2. **ocr/confirm/route.ts: ใน item processing loop**
   - หลัง insert lot สำเร็จ:
   ```ts
   if (item.supplier_id) {
     await supabase
       .from("item_suppliers")
       .upsert(
         { item_id: item.item_id, supplier_id: item.supplier_id, name_at_supplier: "" },
         { onConflict: "item_id,supplier_id", ignoreDuplicates: true }
       );
   }
   ```

---

## ฟีเจอร์ 5: ปรับปรุง value report ให้แสดงชัดว่าใช้ต้นทุนจริง

### สถานะปัจจุบัน
**value-report ใช้ข้อมูลถูกต้องอยู่แล้ว** - ใช้ `calculateWAC()` และ `calculateTotalValue()` จาก inventory lots ซึ่งคำนวณจาก `lot.unit_price` (ราคาต้นทุนจริงที่ซื้อมา) ไม่ได้ใช้ `custom_price`

### ไฟล์ที่ต้องแก้ไข
- `app/(dashboard)/value-report/page.tsx` - ปรับปรุง UI

### รายละเอียดการเปลี่ยนแปลง

1. **ปรับ subtitle ให้ชัดเจนขึ้น:**
   ```
   "มูลค่าสินค้าคงเหลือแยกตามหมวดหมู่ (คำนวณจากต้นทุนจริงแต่ละ lot - FIFO WAC)"
   ```

2. **เพิ่ม info tooltip/badge ที่หัวคอลัมน์ WAC:**
   ```
   "WAC = Weighted Average Cost คำนวณจากราคาซื้อจริงแต่ละ lot ถ่วงน้ำหนักด้วยจำนวนคงเหลือ"
   ```

3. **เพิ่มคอลัมน์ "จำนวน lot" ในตาราง** (optional)
   - แสดงว่าสินค้ามีกี่ lot เพื่อ transparency

---

## ลำดับการ Execute

| Step | งาน | ไฟล์ |
|------|------|------|
| 1 | ปรับ master-data store ให้ fetch item_suppliers | `stores/master-data.ts` |
| 2 | ฟีเจอร์ 4: auto-upsert item_suppliers ใน transactions API | `app/api/transactions/route.ts` |
| 3 | ฟีเจอร์ 4: auto-upsert item_suppliers ใน OCR confirm API | `app/api/ocr/confirm/route.ts` |
| 4 | สร้าง stock-recommendations utility | `lib/utils/stock-recommendations.ts` |
| 5 | ปรับ OCR matching ให้ใช้ name_at_supplier | `lib/ocr.ts` |
| 6 | ปรับ OCR process API ให้ส่ง item_suppliers | `app/api/ocr/process/route.ts` |
| 7 | ปรับ items page (ใหญ่สุด): ราคาแนะนำ + supplier names + min stock แนะนำ | `app/(dashboard)/items/page.tsx` |
| 8 | ปรับ value report UI | `app/(dashboard)/value-report/page.tsx` |
| 9 | ทดสอบ build | `npm run build` |
| 10 | อัพเดท memory | `.claude/memory/` |

---

## Risks & Considerations

1. **Performance**: ดึง inventory lots + out-transactions ในหน้า items อาจช้าถ้ามีข้อมูลมาก → ใช้ `useMemo` + lazy loading
2. **item_suppliers upsert**: ใช้ `ignoreDuplicates: true` เพื่อไม่ overwrite `name_at_supplier` ที่ user ตั้งไว้แล้ว
3. **OCR name_at_supplier auto-save**: ต้อง pass `parsed_name` จาก OCR confirm ไปด้วยเพื่อบันทึก (ต้องเพิ่มใน ConfirmItem interface)
4. **Safety factor 5 วัน**: เป็นค่า default ที่เหมาะสมสำหรับร้านอาหาร (สั่งได้ 1-2 ครั้ง/สัปดาห์)
