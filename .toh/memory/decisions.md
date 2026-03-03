# 🧠 Key Decisions

## Architecture Decisions
| Date | Decision | Reason |
|------|----------|--------|
| 2026-01-27 | Use Toh Framework | AI-Orchestration Driven Development |
| 2026-01-27 | Backend: Google Apps Script + Google Sheets | User requirement; no Supabase/Next.js for this project |
| 2026-01-27 | Keep existing GAS + React (Index.html) stack | Project already built; complete & extend rather than migrate |

## Design Decisions
| Date | Decision | Reason |
|------|----------|--------|
| 2026-01-27 | UI: Mobile First, Responsive any device, User Friendly | User request; prioritise small screens, touch, clarity |
| 2026-02-01 | Dashboard: Quick Actions block + ภาษาง่าย (รับของจากซัพพลายเออร์, ส่งของไปสาขาอื่น) | พนักงานหน้าร้านเข้าใจง่าย ไม่ต้องรู้ศัพท์เทคนิค |
| 2026-02-01 | Modals: Search box แทน dropdown สำหรับสินค้า/สาขา | ค้นหาสินค้าได้รวดเร็วบนมือถือ ใช้พิมพ์แทนเลื่อนยาว |
| 2026-02-01 | Stock Take: Search + Card layout บนมือถือ | หาสินค้าได้เร็ว input ใหญ่แตะง่าย |

## Business Logic
| Date | Decision | Reason |
|------|----------|--------|
| 2026-01-27 | WAC จาก Tx type 'in' เท่านั้น: Σ(amount×unitPrice)/Σ(amount) ต่อสินค้า | ต้นทุนเฉลี่ยจากการสั่งซื้อ; ไม่นับโอน/ปรับยอด |
| 2026-01-27 | เก็บ unitPrice ใน Inventory ต่อ lot และ unitPrice,totalPrice ใน Transactions สำหรับ 'in' | รองรับราคาตอนนำเข้า + รายงาน + WAC |
| 2026-02-02 | Persist cost calculator menus in Sheets: Menus + MenuIngredients + MenuOverheads | Avoid JSON-in-cell; easier CRUD and future reporting |
| 2026-02-02 | กรณีนำเข้าผิด: ใช้ฟีเจอร์เดิม "เบิกของ" หรือ "ตรวจนับสต็อกจริง" (ไม่สร้างปุ่มยกเลิกนำเข้าแยก) | เบิกของ = ประวัตินำออกชัด; ปรับยอด = ให้ยอดตรงของจริง; ลดความซับซ้อนระบบ |
| 2026-02-02 | แผน 4 ข้อ: (1) Success+Redirect ไปประวัติ (2) แก้ไขประวัติของตัวเองภายใน 1 ชม. (3) หน้า Master มูลค่า (4) เหตุผลเบิก+ของเสีย outReason/outValue | เก็บใน development-plan-ux-and-master.md ลำดับทำ 1→2→3→4 |

## Rejected Ideas
| Date | Idea | Why Rejected |
|------|------|--------------|

---
*Last updated: 2026-01-27*
