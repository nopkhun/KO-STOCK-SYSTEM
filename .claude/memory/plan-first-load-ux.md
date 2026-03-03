# 🧠 Development Plan: ปรับปรุงประสบการณ์การโหลดครั้งแรก

**วันที่:** 2026-03-01  
**คำขอ:** ลดเวลาที่โหลดนานก่อนเห็นหน้าต่างเข้าสู่ระบบ และหลังเข้าสู่ระบบโหลดข้อมูลนาน — ต้องการปรับปรุง UX

---

## 📊 สรุปการวิเคราะห์

### สถาปัตยกรรมปัจจุบัน
- **Host:** Cloudflare Worker แสดง HTML + loading overlay แล้วโหลด iframe ไปที่ GAS URL; ซ่อน loading เมื่อ `iframe.onload` (คือเมื่อเอกสารใน iframe โหลดเสร็จทั้งหมด)
- **แอปหลัก:** ไฟล์เดียว `Index.html` (GAS HtmlService)
  - ใน `<head>`: Tailwind, React, React-DOM, Babel, Lucide (CDN) — **บล็อกการ parse**
  - Body: สคริปต์ใหญ่หนึ่งก้อน (Babel/JSX) + `root.render(<App />)`
  - เมื่อ mount: อ่าน sessionStorage สำหรับ auth → ถ้ามี token เรียก `loadData()` = **getSystemData(token)** ครั้งเดียว ดึงทุกชีต (Items, Branches, Units, Categories, Suppliers, ItemSuppliers, Menus, MenuIngredients, MenuOverheads, **Inventory**, **Transactions**)

### ปัญหาที่ทำให้โหลดช้า

| จุด | สาเหตุ |
|-----|--------|
| **ก่อนเห็นหน้า Login** | ต้องโหลด (1) หน้า GAS ทั้งก้อน (2) CDN หลายตัว (3) Parse + Babel + React mount จึงจะ render เงื่อนไข `if (!token)` เป็นฟอร์มเข้าสู่ระบบ |
| **หลังเข้าสู่ระบบ** | เรียก `getSystemData` เดียว ดึงทุกชีตรวมถึง Inventory + Transactions ขนาดใหญ่ → ใช้เวลาทั้งที่ GAS และการส่งข้อมูล |

---

## 📋 แผนงาน (Work Plan)

### Phase 1: ให้หน้า Login ขึ้นเร็วที่สุด (First Content Fast)

| Agent | Task |
|-------|------|
| 🎨 UI / ⚙️ Dev | **Static Login Shell** — ใน `Index.html` ใส่ฟอร์มเข้าสู่ระบบเป็น HTML + CSS inline ภายใน `<div id="root">` **ก่อน** สคริปต์ใหญ่ (หรือเป็นเนื้อหาเริ่มต้นของ #root) เพื่อให้ผู้ใช้เห็นฟอร์มทันทีที่ HTML มาจาก GAS โดยยังไม่ต้องรอ React/Babel/CDN |
| ⚙️ Dev | เมื่อ React mount เสร็จ: ถ้า `!token` ให้ซ่อนหรือแทนที่ static form ด้วย React login form (หรือใช้ static form เดิมแล้ว inject event ด้วย script เล็ก); ถ้ามี token ให้แสดง main app และโหลดข้อมูลตามเดิม |
| ⚙️ Dev | (ทางเลือก) โหลดสคริปต์ CDN แบบ `defer` และเก็บ static form ใน #root เป็น fallback จนกว่า React จะ mount |

**ผลลัพธ์ที่คาดหวัง:** ผู้ใช้เห็นฟอร์ม "เข้าสู่ระบบ" ภายใน 1–3 วินาที (ขึ้นกับความเร็ว GAS + HTML) แทนที่จะรอ 5–15 วินาที

---

### Phase 2: แยกการโหลดข้อมูลหลัง Login (Progressive / Two-phase load)

| Agent | Task |
|-------|------|
| 🗄️ Backend (Code.gs) | สร้าง `getSystemDataBasic(token)` — คืนเฉพาะ Items, Branches, Units, Categories, Suppliers, ItemSuppliers, Menus, MenuIngredients, MenuOverheads (ไม่รวม Inventory, Transactions) |
| 🗄️ Backend (Code.gs) | สร้าง `getInventoryAndTransactions(token)` — คืนเฉพาะ `stock` และ `transactions` |
| ⚙️ Dev (Index.html) | หลัง login: เรียก `getSystemDataBasic` ก่อน → เมื่อได้แล้วอัปเดต state (items, branches, units, categories, suppliers, itemSuppliers, menus, ...) และ **setIsLoading(false)** เพื่อให้ UI หลัก (sidebar, แดชบอร์ด, รายการ) ขึ้นได้ทันที |
| ⚙️ Dev (Index.html) | เรียก `getInventoryAndTransactions` ในพื้นหลัง (หรือหลัง getSystemDataBasic success) → เมื่อได้แล้วอัปเดต `stock` และ `transactions`; แท็บที่ใช้สต็อก/ประวัติ แสดง skeleton หรือ "กำลังโหลด..." จนกว่าข้อมูลจะมา |

**ผลลัพธ์ที่คาดหวัง:** หลัง login แดชบอร์ดและเมนูขึ้นเร็ว; ส่วนสต็อก/ประวัติโหลดตามมาแบบ progressive

---

### Phase 3: ปรับปรุงการรับรู้ (Perceived performance)

| Agent | Task |
|-------|------|
| 🎨 UI | ในหน้าแดชบอร์ด: แสดง skeleton / placeholder สำหรับการ์ดสรุปและตารางจนกว่าข้อมูลจะโหลดครบ |
| 🎨 UI | หน้า Cloudflare: ปรับข้อความ loading ให้สอดคล้อง (เช่น "กำลังเตรียมระบบ..." และอาจซ่อน overlay เมื่อ iframe load ตามเดิม หรือใช้ timeout สูงสุด 15 วินาทีแล้วซ่อนเพื่อไม่ให้ค้าง) |

---

### Phase 4 (Optional): Cache ข้อมูล Master

| Agent | Task |
|-------|------|
| ⚙️ Dev | หลังโหลด getSystemDataBasic สำเร็จ: เก็บ items, branches, units, categories, suppliers, itemSuppliers (และถ้าต้องการ menus) ลง sessionStorage (หรือ in-memory) ด้วย key ที่ผูกกับ token/session |
| ⚙️ Dev | ครั้งถัดไปที่เปิดแอป (ใน session เดียว): ถ้ามี token และมี cache ให้แสดง UI จาก cache ทันที แล้ว refetch ในพื้นหลังเพื่ออัปเดต (หรือใช้ cache เฉพาะสำหรับ "โหลดครั้งแรกหลัง login" เพื่อลดเวลาแสดงผล) |

---

## ⏱️ การประมาณเวลา

| Phase | ประมาณ |
|-------|--------|
| Phase 1: Static Login Shell | 20–40 นาที |
| Phase 2: Two-phase load (Code.gs + Index.html) | 40–60 นาที |
| Phase 3: Skeleton / ข้อความ loading | 15–25 นาที |
| Phase 4: Cache (optional) | 20–30 นาที |

---

## 🚀 ขั้นตอนถัดไป

- เลือกเริ่มจาก **Phase 1** (แนะนำ) เพื่อให้ผู้ใช้เห็นหน้า Login เร็วขึ้นก่อน
- จากนั้นทำ **Phase 2** เพื่อลดเวลาหลัง login
- Phase 3 และ 4 ทำตามลำดับหรือข้ามได้ตามความเหมาะสม

---
*แผนนี้บันทึกใน `.claude/memory/plan-first-load-ux.md`*
