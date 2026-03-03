// ==========================================
// Core Types
// ==========================================

/** Base entity with common fields */
export interface BaseEntity {
  id: string
  createdAt: Date
  updatedAt: Date
}

/** User profile */
export interface User extends BaseEntity {
  email: string
  name: string
  avatar?: string
  role: 'admin' | 'user'
}

/** Product entity example */
export interface Product extends BaseEntity {
  name: string
  description: string
  price: number
  stock: number
  category: string
  imageUrl?: string
  isActive: boolean
}

/** Order entity example */
export interface Order extends BaseEntity {
  userId: string
  items: OrderItem[]
  status: OrderStatus
  total: number
  shippingAddress: Address
}

export interface OrderItem {
  productId: string
  productName: string
  quantity: number
  price: number
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled'

export interface Address {
  street: string
  district: string
  province: string
  postalCode: string
}

// ==========================================
// Input Types (for forms/API)
// ==========================================

export type CreateProductInput = Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
export type UpdateProductInput = Partial<CreateProductInput>

export type CreateOrderInput = Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
  status?: OrderStatus
}

// ==========================================
// API Response Types
// ==========================================

export interface ApiResponse<T> {
  data: T
  error: string | null
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ==========================================
// UI State Types
// ==========================================

export interface LoadingState {
  isLoading: boolean
  error: string | null
}

export interface ModalState {
  isOpen: boolean
  data?: unknown
}

export interface FilterState {
  search: string
  category?: string
  status?: string
  sortBy: string
  sortOrder: 'asc' | 'desc'
}
