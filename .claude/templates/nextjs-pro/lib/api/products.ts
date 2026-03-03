import { Product } from '@/types'
import { mockProducts } from '@/lib/mock-data'

// Simulate API delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// In-memory storage (will be replaced with Supabase)
let products = [...mockProducts]

// ==========================================
// CRUD Operations
// ==========================================

export async function getProducts(): Promise<Product[]> {
  await delay(300)
  return products
}

export async function getProduct(id: string): Promise<Product> {
  await delay(200)
  const product = products.find((p) => p.id === id)
  if (!product) {
    throw new Error('ไม่พบสินค้าที่ต้องการ')
  }
  return product
}

export async function createProduct(
  input: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Product> {
  await delay(400)
  
  const newProduct: Product = {
    ...input,
    id: `prod-${Date.now()}`,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  
  products = [newProduct, ...products]
  return newProduct
}

export async function updateProduct(
  id: string,
  input: Partial<Product>
): Promise<Product> {
  await delay(300)
  
  const index = products.findIndex((p) => p.id === id)
  if (index === -1) {
    throw new Error('ไม่พบสินค้าที่ต้องการอัพเดท')
  }
  
  const updated: Product = {
    ...products[index],
    ...input,
    updatedAt: new Date(),
  }
  
  products = products.map((p) => (p.id === id ? updated : p))
  return updated
}

export async function deleteProduct(id: string): Promise<void> {
  await delay(300)
  
  const index = products.findIndex((p) => p.id === id)
  if (index === -1) {
    throw new Error('ไม่พบสินค้าที่ต้องการลบ')
  }
  
  products = products.filter((p) => p.id !== id)
}

// ==========================================
// Additional Queries
// ==========================================

export async function getProductsByCategory(category: string): Promise<Product[]> {
  await delay(250)
  return products.filter((p) => p.category === category)
}

export async function searchProducts(query: string): Promise<Product[]> {
  await delay(300)
  const lowerQuery = query.toLowerCase()
  return products.filter(
    (p) =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery)
  )
}
