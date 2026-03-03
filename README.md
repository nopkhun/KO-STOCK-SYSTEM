# 🏪 KO Stock System

> ระบบจัดการคลังสินค้าและวัตถุดิบสำหรับร้านอาหาร / F&B  
> สร้างด้วย Google Apps Script + Google Sheets + React

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Platform](https://img.shields.io/badge/platform-Google%20Apps%20Script-orange)
![License](https://img.shields.io/badge/license-MIT-green)

---

## ✨ Features

| หมวด | ความสามารถ |
|------|-----------|
| 📦 **นำเข้าสินค้า** | รับสินค้าหลายรายการพร้อมกัน, เลือกคู่ค้า, ราคาต่อหน่วย, วันหมดอายุ |
| 📤 **เบิกสินค้า** | FIFO deduction อัตโนมัติ, ระบุเหตุผล, คำนวณมูลค่าต้นทุน |
| 🔄 **โอนสินค้า** | โอนระหว่างสาขา, หักสต็อกต้นทาง-เพิ่มปลายทางอัตโนมัติ |
| 📊 **ปรับยอดสต็อก** | ตรวจนับสต็อกจริง เปรียบเทียบกับระบบ, ปรับด้วย FIFO |
| 🏬 **Multi-branch** | รองรับหลายสาขา, แสดงสต็อกแยกสาขา |
| 📈 **รายงาน** | สรุปสต็อก, ประวัติเข้าออก, รายงานราคาซื้อ, มูลค่าสต็อก, ของเสีย |
| 🍽️ **ต้นทุนอาหาร** | คำนวณต้นทุนเมนู, WAC วัตถุดิบ, ราคาขายแนะนำ |
| 👥 **Multi-user** | Role-based access (Master / Admin / Viewer), ประวัติการใช้งาน |

---

## 🏗️ Tech Stack

```
Frontend  → React 18 (CDN) + Tailwind CSS + Lucide Icons + Babel Standalone
Backend   → Google Apps Script (Code.gs)
Database  → Google Sheets (Items, Branches, Inventory, Transactions, ...)
Auth      → Token-based (UUID + expiry, SHA-256 password hash)
```

---

## 📁 โครงสร้างไฟล์

```
KO-Stock-System/
├── Code.gs              # Google Apps Script backend
├── Index.html           # Single-page React frontend
├── tests/
│   ├── logic.test.js    # Unit tests (FIFO, date parsing)
│   └── MANUAL-TEST-PLAN.md
└── .toh/memory/         # Project documentation & decisions
```

---

## ⚙️ การติดตั้ง

### 1. สร้าง Google Spreadsheet

สร้าง Google Spreadsheet ใหม่ และสร้าง Sheets ชื่อ:

| Sheet | คำอธิบาย |
|-------|---------|
| `Items` | รายการสินค้า/วัตถุดิบ |
| `Branches` | รายการสาขา |
| `Inventory` | lot-based คลังสินค้า (FIFO) |
| `Transactions` | ประวัติเข้า-ออก-โอน-ปรับ |
| `Units` | หน่วยสินค้า |
| `Categories` | หมวดหมู่สินค้า |
| `Suppliers` | คู่ค้า/ผู้จัดจำหน่าย |
| `ItemSuppliers` | ความสัมพันธ์สินค้า-คู่ค้า |
| `Users` | ผู้ใช้งาน (สร้างอัตโนมัติ) |
| `Tokens` | Token สำหรับ Auth (สร้างอัตโนมัติ) |
| `AuditLog` | ล็อกการใช้งาน (สร้างอัตโนมัติ) |

### 2. สร้าง Google Apps Script Project

1. เปิด Spreadsheet → **Extensions → Apps Script**
2. ลบ code เดิม แล้ว paste `Code.gs` ทั้งหมด
3. เพิ่มไฟล์ใหม่ชื่อ `Index.html` → paste `Index.html`
4. Deploy → **New deployment** → เลือก **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (หรือ **Anyone in your organization**)
5. Copy URL จาก deployment

### 3. เริ่มใช้งาน

- เปิด URL จาก deployment
- Login ด้วย `admin` / `admin123` (ครั้งแรก ระบบจะให้เปลี่ยนรหัสผ่าน)
- ตั้งค่าระบบ: เพิ่มหน่วย, หมวดหมู่, สาขา, สินค้า

---

## 📦 Inventory Logic (FIFO)

ระบบใช้ **FIFO (First In, First Out)** สำหรับการตัดสต็อก:

```
Lot เก่าสุด → ตัดก่อน → Lot ใหม่กว่า → ตัดหลัง
```

- **In:** สร้าง Lot ใหม่ใน Inventory sheet
- **Out:** ตัด Lot เก่าก่อน (FIFO), คำนวณ `outValue = qty × unitPrice`
- **Transfer:** ตัดจากต้นทาง (FIFO) + เพิ่ม Lot ใหม่ที่ปลายทาง
- **Adjust:** ถ้ายอดจริงน้อยกว่าระบบ → FIFO deduct; ถ้ามากกว่า → เพิ่ม Lot ใหม่

---

## 🧪 Running Tests

```bash
node tests/logic.test.js
```

```
✅ All 12 logic tests passed.
```

---

## 🔒 Security

- Password hashed ด้วย SHA-256 (Base64)
- Token-based authentication (UUID, หมดอายุ 7 วัน)
- Role-based access: Master > Admin > Viewer
- LockService ป้องกัน race condition ขณะบันทึกข้อมูล

---

## 📝 Changelog

### v1.0.0 (2026-03-03)
- ✅ ระบบ FIFO สมบูรณ์ (In/Out/Transfer/Adjust)
- ✅ Multi-branch support
- ✅ Multi-user with role-based access
- ✅ ต้นทุนอาหาร (WAC + Food Cost Calculator)
- ✅ รายงานครบ (สต็อก, ประวัติ, ราคาซื้อ, มูลค่า)
- 🐛 Fix: `updateTransaction` out — อ่าน Inventory sheet แบบ batch แทนทีละแถว (ป้องกัน timeout)
- 🐛 Fix: `updateTransaction` in — คืน expiryDate เดิมเมื่อแก้ไขรายการ
- 🐛 Fix: Adjust note แสดง direction (+/-) ชัดเจน
- ⚡ Lock timeout ขยายจาก 5s → 10s

---

## 📄 License

MIT License — Free to use and modify.

---

*Built with ❤️ for Restaurant & F&B businesses*
