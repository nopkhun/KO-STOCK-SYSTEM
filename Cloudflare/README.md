# Kostock Inventory — GAS Iframe บน Cloudflare Worker

หน้าเว็บสำหรับแสดงผล Google Apps Script (GAS) Web App ผ่าน iframe โดย deploy เป็น Cloudflare Worker เพื่อใช้โดเมนถาวร (เช่น `*.workers.dev` หรือ Custom Domain)

## สิ่งที่ได้

- **index.html** — หน้า iframe พร้อม loading, fallback เมื่อโหลดไม่สำเร็จ และลิงก์เปิดในแท็บใหม่
- **worker.js** — Worker serve HTML และ inject URL ของ GAS จาก env
- **wrangler.toml** — ใช้ deploy และตั้งค่า `GAS_URL`

## วิธี Deploy

### 1. ติดตั้ง Wrangler (ครั้งเดียว)

```bash
npm install -g wrangler
# หรือใช้ในโปรเจกต์: npm i -D wrangler
```

### 2. Login Cloudflare (ครั้งเดียว)

```bash
npx wrangler login
```

### 3. ตั้งค่า URL ของ GAS

แก้ใน `wrangler.toml` ที่ `[vars]` → `GAS_URL` หรือใช้ secret (ไม่แสดงใน repo):

```bash
npx wrangler secret put GAS_URL
# แล้ววาง URL ของ GAS Web App ตอนที่ถาม
```

### 4. Deploy

```bash
cd Cloudflare
npx wrangler deploy
```

หลัง deploy สำเร็จ จะได้ URL แบบถาวร เช่น:

- `https://kostock-inventory.<your-subdomain>.workers.dev`

## โดเมนถาวร

### ใช้โดเมนฟรี workers.dev

- บัญชี Cloudflare จะได้ subdomain `*.workers.dev` อัตโนมัติ
- URL นี้ใช้ได้เรื่อยๆ ไม่หมดอายุ

### ใช้ Custom Domain

1. เปิด [Cloudflare Dashboard](https://dash.cloudflare.com) → **Workers & Pages**
2. เลือก Worker **kostock-inventory**
3. ไปที่ **Settings** → **Domains & Routes**
4. กด **Add** → เลือกโดเมนที่อยู่ใน Cloudflare แล้วกำหนด path (เช่น `inventory.example.com` หรือ `example.com/inventory`)

## โครงสร้างไฟล์

```
Cloudflare/
├── index.html      # ต้นแบบ HTML (ใช้ placeholder __GAS_URL__)
├── worker.js       # Worker ที่ inject GAS_URL แล้ว serve HTML
├── wrangler.toml   # Config สำหรับ wrangler deploy
├── PLAN.md         # แผนการปรับปรุง
└── README.md       # ไฟล์นี้
```

## ทำไมหน้าแรกโหลดช้า (5+ วินาที)

การโหลดช้าครั้งแรกเกิดจาก **Google Apps Script (GAS) cold start** ไม่ใช่จาก Cloudflare Worker

- **Worker** แค่ส่ง HTML เล็กๆ มาทันที (มัก &lt; 100 ms)
- **iframe** จะโหลด URL ของ GAS — ฝั่ง GAS ครั้งแรกมักใช้เวลา **5–15 วินาที** เพราะ:
  - Google ต้อง warm up รันสคริปต์ (cold start)
  - โปรเจกต์ที่ไม่ได้ใช้สักพักอาจถูกปิด แล้วเปิดใหม่เมื่อมี request
  - การโหลด libraries / เชื่อม Spreadsheet เพิ่มเวลา

การโหลดครั้งถัดไป (ภายในช่วงที่ GAS ยัง warm อยู่) มักจะเร็วขึ้น

**ถ้าต้องการให้ GAS เร็วขึ้น (ฝั่งสคริปต์):** ลดการใช้ library ภายนอก, รวม CSS/JS ให้โหลดน้อยไฟล์, ลดงานใน `doGet()` ครั้งแรก (เช่น lazy load ข้อมูล). ดูได้จาก [การลดเวลาโหลดของ Google Script](https://stackoverflow.com/questions/13927363/how-to-minimize-loading-time-of-a-google-script) และ [Google Apps Script region / latency](https://pulse.appsscript.info/p/2024/09/google-cloud-region-latency-in-google-apps-script).

ในหน้านี้เราแจ้งผู้ใช้แล้วว่า "หน้าแรกอาจใช้เวลา 5–15 วินาที" เพื่อไม่ให้รู้สึกว่าระบบค้าง

## หมายเหตุ

- ถ้าไม่ตั้ง `GAS_URL` (ทั้งใน vars และ secret) หน้า will แสดงแต่ลิงก์ fallback
- แก้ HTML แบบเต็มได้ที่ `index.html` จากนั้นต้อง copy ไปใส่ใน `worker.js` ที่ `HTML_TEMPLATE` (หรือใช้ build script รวมให้ภายหลัง)
