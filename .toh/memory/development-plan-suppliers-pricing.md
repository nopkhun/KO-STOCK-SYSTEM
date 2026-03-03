# 🎯 Development Plan: คู่ค้า + ราคาซื้อ + ต้นทุนเฉลี่ย + รายงานราคา

## 📊 Summary

เพิ่มระบบ **จัดการคู่ค้า (Suppliers)** แทนรายชื่อคู่ค้าแบบ hardcode ปัจจุบัน และขยายความสามารถดังนี้:

1. **เมนูจัดการคู่ค้า** – CRUD คู่ค้า (เพิ่ม/แก้ไข/ลบ)
2. **รายละเอียดสินค้า–คู่ค้า** – แต่ละสินค้าซื้อได้ที่คู่ค้าไหนบ้าง และ **ชื่อสินค้าที่คู่ค้า** (nameAtSupplier)
3. **ราคาตอนนำเข้า** – กรอกราคาต่อหน่วย (และยอดรวม) ตอนรับสินค้า
4. **ต้นทุนเฉลี่ย (WAC)** – คำนวณจากประวัติการสั่งซื้อ (นำเข้า)
5. **รายงานราคาซื้อ** – ดูราคาการสั่งซื้อแยกตามช่วงเวลา (และตัวกรองสินค้า/คู่ค้า)

---

## 🗂️ Data Model Changes

| Sheet | Action | Columns |
|-------|--------|---------|
| **Suppliers** | **NEW** | `id`, `name` |
| **ItemSuppliers** | **NEW** | `itemId`, `supplierId`, `nameAtSupplier` |
| **Inventory** | **CHANGE** | เพิ่ม `unitPrice` |
| **Transactions** | **CHANGE** | เพิ่ม `unitPrice`, `totalPrice` (ใช้กับ type `in`) |

- คู่ค้าปัจจุบัน: hardcode `SUPPLIERS` ใน Index → จะเปลี่ยนไปใช้จาก Sheet **Suppliers**
- ล็อตใน Inventory แต่ละครั้งรับเข้า จะเก็บ `unitPrice` ได้
- Transaction ประเภท "นำเข้า" จะเก็บ `unitPrice`, `totalPrice` เพื่อใช้คำนวณ WAC และรายงาน

---

## 📋 Work Plan

### Phase 1: Suppliers CRUD + แทนที่ SUPPLIERS (~25 นาที)

| Agent | Task |
|-------|------|
| 🗄️ Backend | สร้าง Sheet **Suppliers** (id, name); `setupSheets` + seed; `saveSupplier`, `deleteSupplier`; `getSystemData` ส่ง `suppliers` |
| 🎨 UI | แท็บ **คู่ค้า** (จัดการเหมือน Units/หมวดหมู่): ตาราง, ปุ่มเพิ่ม/แก้ไข/ลบ, โมดัลฟอร์ม |
| ⚙️ Dev | state `suppliersMaster`, handlers บันทึก/ลบ; ในโมดัลรับสินค้าใช้ `<select>` จาก `suppliersMaster` แทน `SUPPLIERS` |

**ผลลัพธ์:** มีเมนูจัดการคู่ค้า และตอนรับสินค้าเลือกคู่ค้าจากรายการจริง

---

### Phase 2: Item–Supplier mapping (ชื่อที่คู่ค้า) (~30 นาที)

| Agent | Task |
|-------|------|
| 🗄️ Backend | สร้าง Sheet **ItemSuppliers** (itemId, supplierId, nameAtSupplier); CRUD `saveItemSupplier`, `deleteItemSupplier`; `getSystemData` ส่ง `itemSuppliers` |
| 🎨 UI | ในแท็บ **รายการสินค้า** เพิ่มส่วน **"ซื้อได้ที่คู่ค้า"**: แสดงตาราง (คู่ค้า, ชื่อที่คู่ค้า), ปุ่มเพิ่ม/แก้ไข/ลบ (หรืออินไลน์ในฟอร์มแก้ไขสินค้า) |
| ⚙️ Dev | state, handlers สำหรับ ItemSuppliers; validation ไม่ให้ซ้ำ (itemId, supplierId) |

**ผลลัพธ์:** แต่ละสินค้าบอกได้ว่าซื้อได้ที่คู่ค้าไหน และชื่อที่คู่ค้าเรียกว่าอะไร

---

### Phase 3: ราคาตอนนำเข้า (~35 นาที)

| Agent | Task |
|-------|------|
| 🗄️ Backend | Inventory เพิ่มคอลัมน์ `unitPrice`; Transactions เพิ่ม `unitPrice`, `totalPrice`; อัปเดต `setupSheets`; แก้ `saveTransaction` / อ่าน Inventory ให้รองรับ `unitPrice` |
| 🎨 UI | โมดัล **รับสินค้า**: แต่ละรายการใน bulk เพิ่มช่อง **ราคาต่อหน่วย** (และแสดงยอดรวม = จำนวน × ราคาต่อหน่วย); โอนย้าย/ปรับยอดยังไม่บังคับราคา |
| ⚙️ Dev | ใน `handleFinalSubmit` (type `in`) ส่ง `unitPrice`, `totalPrice` ต่อ tx และต่อ lot; โครงสร้าง lot ใน frontend เพิ่ม `unitPrice` |

**ผลลัพธ์:** ตอนรับสินค้าสามารถกรอกราคาต่อหน่วยได้ และเก็บใน Inventory + Transactions

---

### Phase 4: ต้นทุนเฉลี่ย (WAC) (~20 นาที)

| Agent | Task |
|-------|------|
| ⚙️ Dev | คำนวณ WAC ต่อสินค้า: จาก Transactions type `in` → WAC = Σ(amount × unitPrice) / Σ(amount); สร้าง helper / useMemo |
| 🎨 UI | แสดง **ต้นทุนเฉลี่ย** ในที่ที่เหมาะสม เช่น แท็บรายการสินค้า (คอลัมน์เสริม), หรือหน้ารายงาน (บล็อกสรุปต่อสินค้า) |

**ผลลัพธ์:** มีตัวเลขต้นทุนเฉลี่ยต่อสินค้าจากประวัติสั่งซื้อ

---

### Phase 5: รายงานราคาซื้อ (~25 นาที)

| Agent | Task |
|-------|------|
| 🎨 UI | ในแท็บ **รายงาน** เพิ่มส่วน **"รายงานราคาซื้อ"**: ตัวกรองช่วงวันที่, สินค้า, คู่ค้า; ตาราง (วันที่, สินค้า, คู่ค้า, จำนวน, หน่วย, ราคาต่อหน่วย, ยอดรวม) |
| ⚙️ Dev | filter ประวัติ type `in` ตามช่วงวันที่/สินค้า/คู่ค้า; ปุ่มส่งออก CSV รายงานราคาซื้อ |

**ผลลัพธ์:** ดูและส่งออกรายงานราคาซื้อแยกตามช่วงเวลา (และตามสินค้า/คู่ค้า)

---

## ⏱️ Total estimate

ประมาณ **135 นาที** (รวมทุก Phase)

---

## 📌 สรุป Phase

| Phase | ชื่อ | ผลหลัก |
|-------|------|--------|
| 1 | Suppliers CRUD + แทนที่ SUPPLIERS | เมนูคู่ค้า, รับสินค้าเลือกคู่ค้าจากระบบ |
| 2 | Item–Supplier mapping | สินค้าซื้อได้ที่ใคร + ชื่อที่คู่ค้า |
| 3 | ราคาตอนนำเข้า | เก็บ unitPrice ในล็อต + tx นำเข้า |
| 4 | WAC | ต้นทุนเฉลี่ยต่อสินค้า |
| 5 | รายงานราคาซื้อ | รายงาน + CSV ราคาซื้อตามช่วง |

---

👉 พิมพ์ **"Go"** หรือ **"เริ่มเลย"** เพื่อเริ่มทำ Phase 1  
หรือบอกได้เลยถ้าต้องการปรับแผน (เช่น ลำดับ Phase, เพิ่ม/ลดฟีเจอร์)
