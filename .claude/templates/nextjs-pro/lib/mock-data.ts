import { Product, Order, User } from '@/types'

// ==========================================
// Mock Users (Thai)
// ==========================================

export const mockUsers: User[] = [
  {
    id: 'user-1',
    email: 'somchai@example.com',
    name: 'สมชาย ใจดี',
    avatar: undefined,
    role: 'admin',
    createdAt: new Date('2024-01-15'),
    updatedAt: new Date('2024-06-20'),
  },
  {
    id: 'user-2',
    email: 'somying@example.com',
    name: 'สมหญิง รักเรียน',
    avatar: undefined,
    role: 'user',
    createdAt: new Date('2024-03-10'),
    updatedAt: new Date('2024-06-18'),
  },
  {
    id: 'user-3',
    email: 'prasit@example.com',
    name: 'ประสิทธิ์ พัฒนา',
    avatar: undefined,
    role: 'user',
    createdAt: new Date('2024-04-22'),
    updatedAt: new Date('2024-06-15'),
  },
]

// ==========================================
// Mock Products (Thai)
// ==========================================

export const mockProducts: Product[] = [
  {
    id: 'prod-1',
    name: 'กาแฟดริป พรีเมียม',
    description: 'กาแฟอาราบิก้า 100% คั่วกลาง หอมกรุ่น รสชาติกลมกล่อม เหมาะสำหรับผู้ที่ชื่นชอบกาแฟแท้ๆ',
    price: 350,
    stock: 150,
    category: 'เครื่องดื่ม',
    imageUrl: undefined,
    isActive: true,
    createdAt: new Date('2024-05-01'),
    updatedAt: new Date('2024-06-15'),
  },
  {
    id: 'prod-2',
    name: 'ชาเขียวมัทฉะ',
    description: 'ผงมัทฉะแท้จากญี่ปุ่น เกรดพรีเมียม เข้มข้น หอมละมุน ใช้ได้ทั้งชงดื่มและทำขนม',
    price: 420,
    stock: 80,
    category: 'เครื่องดื่ม',
    imageUrl: undefined,
    isActive: true,
    createdAt: new Date('2024-05-10'),
    updatedAt: new Date('2024-06-12'),
  },
  {
    id: 'prod-3',
    name: 'คุกกี้ช็อกโกแลต',
    description: 'คุกกี้เนยสด สอดไส้ช็อกโกแลตเข้มข้น กรอบนอกนุ่มใน อร่อยเกินห้ามใจ',
    price: 180,
    stock: 200,
    category: 'ขนม',
    imageUrl: undefined,
    isActive: true,
    createdAt: new Date('2024-05-15'),
    updatedAt: new Date('2024-06-10'),
  },
  {
    id: 'prod-4',
    name: 'น้ำผึ้งป่าแท้',
    description: 'น้ำผึ้งป่าธรรมชาติ 100% จากภาคเหนือ หวานหอม มีประโยชน์ต่อสุขภาพ',
    price: 280,
    stock: 50,
    category: 'สุขภาพ',
    imageUrl: undefined,
    isActive: true,
    createdAt: new Date('2024-04-20'),
    updatedAt: new Date('2024-06-08'),
  },
  {
    id: 'prod-5',
    name: 'แก้วกาแฟเซรามิก',
    description: 'แก้วกาแฟทำมือ เซรามิกเกรดพรีเมียม ดีไซน์มินิมอล เก็บความร้อนได้ดี',
    price: 450,
    stock: 30,
    category: 'อุปกรณ์',
    imageUrl: undefined,
    isActive: false,
    createdAt: new Date('2024-03-15'),
    updatedAt: new Date('2024-05-20'),
  },
]

// ==========================================
// Mock Orders (Thai)
// ==========================================

export const mockOrders: Order[] = [
  {
    id: 'order-1',
    userId: 'user-2',
    items: [
      { productId: 'prod-1', productName: 'กาแฟดริป พรีเมียม', quantity: 2, price: 350 },
      { productId: 'prod-3', productName: 'คุกกี้ช็อกโกแลต', quantity: 1, price: 180 },
    ],
    status: 'delivered',
    total: 880,
    shippingAddress: {
      street: '123/45 ซอยสุขุมวิท 55',
      district: 'วัฒนา',
      province: 'กรุงเทพมหานคร',
      postalCode: '10110',
    },
    createdAt: new Date('2024-06-01'),
    updatedAt: new Date('2024-06-05'),
  },
  {
    id: 'order-2',
    userId: 'user-3',
    items: [
      { productId: 'prod-2', productName: 'ชาเขียวมัทฉะ', quantity: 3, price: 420 },
    ],
    status: 'shipped',
    total: 1260,
    shippingAddress: {
      street: '789 ถนนเชียงใหม่-ลำปาง',
      district: 'เมือง',
      province: 'เชียงใหม่',
      postalCode: '50000',
    },
    createdAt: new Date('2024-06-10'),
    updatedAt: new Date('2024-06-12'),
  },
  {
    id: 'order-3',
    userId: 'user-2',
    items: [
      { productId: 'prod-4', productName: 'น้ำผึ้งป่าแท้', quantity: 2, price: 280 },
      { productId: 'prod-5', productName: 'แก้วกาแฟเซรามิก', quantity: 1, price: 450 },
    ],
    status: 'pending',
    total: 1010,
    shippingAddress: {
      street: '123/45 ซอยสุขุมวิท 55',
      district: 'วัฒนา',
      province: 'กรุงเทพมหานคร',
      postalCode: '10110',
    },
    createdAt: new Date('2024-06-18'),
    updatedAt: new Date('2024-06-18'),
  },
]

// ==========================================
// Categories
// ==========================================

export const categories = [
  { value: 'เครื่องดื่ม', label: 'เครื่องดื่ม' },
  { value: 'ขนม', label: 'ขนม' },
  { value: 'สุขภาพ', label: 'สุขภาพ' },
  { value: 'อุปกรณ์', label: 'อุปกรณ์' },
]

export const orderStatuses = [
  { value: 'pending', label: 'รอดำเนินการ' },
  { value: 'confirmed', label: 'ยืนยันแล้ว' },
  { value: 'shipped', label: 'จัดส่งแล้ว' },
  { value: 'delivered', label: 'ส่งถึงแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
]
