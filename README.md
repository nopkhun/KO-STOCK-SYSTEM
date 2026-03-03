# KO-Stock-System (FoodStock Manager) 📦

ระบบจัดการสต็อกวัตถุดิบและคำนวณต้นทุนอาหาร สำหรับร้านอาหารและธุรกิจ F&B พัฒนาด้วย **Google Apps Script (GAS)** และ **React**

> **"Type Once, Have it all!"** — จัดการคลังสินค้าแบบ FIFO, โอนย้ายระหว่างสาขา, และวิเคราะห์ต้นทุนได้ในที่เดียว

---

## ✨ Features

### 🛒 การจัดการสต็อก (Inventory Management)
- **ระบบ FIFO (First-In, First-Out):** ตัดสต็อกตามล็อตที่เข้าก่อน เพื่อความแม่นยำของต้นทุนและอายุการใช้งาน
- **Multi-branch Support:** รองรับการจัดการหลายสาขา พร้อมระบบโอนย้ายสินค้า (Transfer) ระหว่างสาขา
- **Stock Take:** ระบบตรวจนับสต็อกจริง พร้อมคำนวณส่วนต่าง (+/-) และปรับยอดอัตโนมัติ
- **Transaction History:** บันทึกประวัติการขยับเขยื้อนของสินค้าทั้งหมด (In, Out, Transfer, Adjust) พร้อมตัวกรองละเอียด

### 💰 ต้นทุนและคู่ค้า (Costing & Suppliers)
- **Food Cost Calculator:** คำนวณต้นทุนต่อจานอัตโนมัติจากราคาวัตถุดิบเฉลี่ย (WAC)
- **Supplier Management:** จัดการข้อมูลคู่ค้าและประวัติการซื้อ
- **Pricing:** รองรับการบันทึกราคาซื้อและหน่วยซื้อที่แตกต่างจากหน่วยใช้งาน

### 📊 รายงานและการวิเคราะห์ (Reports)
- **Dashboard:** สรุปภาพรวมสินค้าใกล้หมด, ยอดล่วงหน้า, และความเคลื่อนไหวประจำวัน
- **Inventory Report:** สรุปยอดคงเหลือรายสินค้าแยกตามสาขา
- **Export CSV:** รองรับการส่งออกข้อมูลรายงานและประวัติเพื่อนำไปใช้งานต่อ

---

## 🛠 Tech Stack

- **Backend:** Google Apps Script (GAS)
- **Database:** Google Sheets
- **Frontend:** React 18, Tailwind CSS, Lucide Icons, Babel (Standalone)
- **State Management:** React Hooks (useState, useMemo, useEffect)

---

## 🚀 การติดตั้งและใช้งาน (Deployment)

1.  **คัดลอกไฟล์:** นำ Code จาก `Code.gs` และ `Index.html` ไปใส่ในโปรเจค Google Apps Script ใหม่
2.  **เตรียม Google Sheets:** ระบบมีฟังก์ชัน `setupSheets` อัตโนมัติเมื่อเริ่มใช้งานครั้งแรก หรือสามารถสร้าง Sheets: `Items`, `Branches`, `Inventory`, `Transactions`, `Users`, `Tokens`, `AuditLog`, `Suppliers`, `Menus`, `MenuIngredients`, `MenuOverheads`
3.  **Deploy:** เลือก "Deploy as Web App" ใน GAS Editor
4.  **ตั้งค่าสิทธิ์:** กำหนดให้ "Anyone with Google Account" เข้าถึงได้

---

## 📄 License & Version
- **Version:** 2025.02.05.FINAL (Logic Audit Patched)
- **Framework:** Toh Framework (AODD)

---
*Last updated: 2026-03-03*
