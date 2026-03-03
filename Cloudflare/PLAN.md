# 🎯 แผนปรับปรุง: GAS Iframe + Cloudflare Worker (โดเมนถาวร)

## 📊 สรุป
ปรับปรุง `Cloudflare/index.html` สำหรับแสดงผล Google Apps Script (GAS) ใน iframe และ deploy เป็น Cloudflare Worker เพื่อให้เข้าถึงผ่านโดเมนถาวร (เช่น `xxx.workers.dev` หรือ Custom Domain)

---

## 📋 แผนงาน

### Phase 1: ปรับปรุง index.html สำหรับ Iframe แสดงผล GAS
**วัตถุประสงค์:** โค้ดแข็งแรง ปลอดภัย แก้ไข URL ง่าย รองรับโหลดล้มเหลว

| หัวข้อ | รายละเอียด |
|--------|-------------|
| **URL ไม่ hardcode** | ใช้ตัวแปรจาก environment (Worker จะ inject) หรือ fallback จาก query/hash เพื่อไม่ต้องแก้ HTML ตอนเปลี่ยน GAS |
| **ความปลอดภัย iframe** | ใช้ `sandbox` และ `allow` ที่เหมาะสม (เช่น `allow-scripts allow-same-origin allow-forms`) เพื่อลดความเสี่ยง |
| **สถานะโหลด** | แสดง loading indicator ขณะ iframe ยังไม่โหลดเสร็จ (ใช้ `iframe.onload`) |
| ** fallback เมื่อโหลดไม่สำเร็จ** | ถ้าโหลดเกินเวลาที่กำหนด หรือมีข้อผิดพลาด แสดงปุ่ม "เปิดในหน้าต่างใหม่" ชัดเจน |
| **Responsive / Viewport** | รองรับมือถือและ desktop (มีอยู่แล้ว แต่ตรวจสอบความสูง 100vh กับ mobile browser) |
| **ภาษา** | ข้อความ UI เป็นภาษาไทย (มีอยู่แล้ว) |

**ผลลัพธ์:** ไฟล์ `index.html` ที่พร้อมให้ Worker serve (หรือใช้เป็น template ที่ Worker แทนที่ `GAS_URL`)

---

### Phase 2: สร้าง Cloudflare Worker เพื่อ serve หน้าและ inject URL
**วัตถุประสงค์:** Deploy ได้จริง มีโดเมนถาวร

| หัวข้อ | รายละเอียด |
|--------|-------------|
| **Worker script** | สร้าง `worker.js` (หรือ `src/index.js`) ที่รับ GET แล้ว return HTML โดยแทนที่ placeholder เช่น `__GAS_URL__` ด้วยค่าจาก env `GAS_URL` |
| **Wrangler** | สร้าง `wrangler.toml` กำหนดชื่อ Worker, zone (ถ้าใช้ custom domain), และตัวแปร `GAS_URL` (หรือใช้ secrets) |
| **โครงสร้างโฟลเดอร์** | เลือกแบบใดแบบหนึ่ง: (ก) Worker อ่านไฟล์ HTML จาก KV/static หรือ (ข) HTML แบบ inline ใน Worker (ไม่ต้องใช้ KV ก็ได้ สำหรับหน้าเดียว) |
| **CORS / Headers** | ตั้งค่า Content-Type: text/html; charset=utf-8 และถ้าต้องการ cache ควบคุมที่ edge ได้ |

**ผลลัพธ์:** รัน `wrangler deploy` แล้วเข้าได้ที่ `https://<name>.<subdomain>.workers.dev`

---

### Phase 3: โดเมนถาวรและเอกสาร Deploy
**วัตถุประสงค์:** ใช้โดเมนถาวรและทีม deploy ซ้ำได้

| หัวข้อ | รายละเอียด |
|--------|-------------|
| **workers.dev** | โดเมนฟรี `*.workers.dev` เป็นโดเมนถาวร (ไม่หมดอายุ) |
| **Custom Domain** | ถ้ามีโดเมนใน Cloudflare: ใน Dashboard → Workers → Route เพิ่ม custom domain ไปที่ Worker นี้ |
| **เอกสาร** | README หรือ COMMENT ใน repo อธิบายสั้นๆ: วิธีตั้ง `GAS_URL`, คำสั่ง `wrangler deploy`, การผูก custom domain |

**ผลลัพธ์:** เข้าถึงระบบผ่าน URL ถาวร และมีขั้นตอน deploy ชัดเจน

---

## ⏱️ ประมาณการเวลา
- Phase 1: ~10 นาที  
- Phase 2: ~15 นาที  
- Phase 3: ~5 นาที  

**รวมประมาณ 30 นาที**

---

## 📁 ไฟล์ที่คาดว่าจะสร้าง/แก้ไข
- `Cloudflare/index.html` — ปรับปรุง (URL จาก config, loading, error handling, iframe attributes)
- `Cloudflare/worker.js` หรือ `Cloudflare/src/index.js` — Worker script
- `Cloudflare/wrangler.toml` — ค่า config Wrangler
- `Cloudflare/README.md` (ถ้าต้องการ) — วิธี deploy และตั้งโดเมน

---

👉 พิมพ์ **"Go"** หรือ **"เริ่มเลย"** เพื่อให้เริ่มทำตามแผน หรือบอกปรับส่วนไหนก่อนได้ครับ
