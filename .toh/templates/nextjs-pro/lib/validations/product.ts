import { z } from 'zod'

// ==========================================
// Product Validation Schemas
// ==========================================

export const createProductSchema = z.object({
  name: z
    .string()
    .min(2, 'ชื่อสินค้าต้องมีอย่างน้อย 2 ตัวอักษร')
    .max(100, 'ชื่อสินค้าต้องไม่เกิน 100 ตัวอักษร'),
  description: z
    .string()
    .min(10, 'คำอธิบายต้องมีอย่างน้อย 10 ตัวอักษร')
    .max(500, 'คำอธิบายต้องไม่เกิน 500 ตัวอักษร'),
  price: z
    .number()
    .min(0, 'ราคาต้องไม่ติดลบ')
    .max(1000000, 'ราคาต้องไม่เกิน 1,000,000'),
  stock: z
    .number()
    .int('จำนวนต้องเป็นจำนวนเต็ม')
    .min(0, 'จำนวนต้องไม่ติดลบ'),
  category: z
    .string()
    .min(1, 'กรุณาเลือกหมวดหมู่'),
  imageUrl: z
    .string()
    .url('URL รูปภาพไม่ถูกต้อง')
    .optional()
    .or(z.literal('')),
  isActive: z.boolean().default(true),
})

export const updateProductSchema = createProductSchema.partial()

// Types derived from schemas
export type CreateProductSchema = z.infer<typeof createProductSchema>
export type UpdateProductSchema = z.infer<typeof updateProductSchema>

// ==========================================
// Address Validation
// ==========================================

export const addressSchema = z.object({
  street: z
    .string()
    .min(5, 'ที่อยู่ต้องมีอย่างน้อย 5 ตัวอักษร')
    .max(200, 'ที่อยู่ต้องไม่เกิน 200 ตัวอักษร'),
  district: z
    .string()
    .min(2, 'กรุณาระบุแขวง/ตำบล'),
  province: z
    .string()
    .min(2, 'กรุณาระบุจังหวัด'),
  postalCode: z
    .string()
    .regex(/^\d{5}$/, 'รหัสไปรษณีย์ต้องเป็นตัวเลข 5 หลัก'),
})

export type AddressSchema = z.infer<typeof addressSchema>

// ==========================================
// Order Validation
// ==========================================

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1, 'จำนวนต้องอย่างน้อย 1'),
})

export const createOrderSchema = z.object({
  items: z.array(orderItemSchema).min(1, 'ต้องมีสินค้าอย่างน้อย 1 รายการ'),
  shippingAddress: addressSchema,
})

export type CreateOrderSchema = z.infer<typeof createOrderSchema>

// ==========================================
// Common Validation Helpers
// ==========================================

export const emailSchema = z
  .string()
  .email('รูปแบบอีเมลไม่ถูกต้อง')

export const phoneSchema = z
  .string()
  .regex(/^0[0-9]{9}$/, 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก เริ่มด้วย 0')

export const thaiNameSchema = z
  .string()
  .min(2, 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร')
  .max(50, 'ชื่อต้องไม่เกิน 50 ตัวอักษร')
