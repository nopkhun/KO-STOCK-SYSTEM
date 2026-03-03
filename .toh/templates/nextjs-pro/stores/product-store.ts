import { create } from 'zustand'
import { Product, FilterState, LoadingState } from '@/types'
import * as api from '@/lib/api/products'

// ==========================================
// Product Store
// ==========================================

interface ProductState extends LoadingState {
  // Data
  products: Product[]
  selectedProduct: Product | null
  
  // Filters
  filters: FilterState
  
  // Actions
  fetchProducts: () => Promise<void>
  getProduct: (id: string) => Promise<void>
  createProduct: (input: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  updateProduct: (id: string, input: Partial<Product>) => Promise<void>
  deleteProduct: (id: string) => Promise<void>
  
  // Filter actions
  setFilters: (filters: Partial<FilterState>) => void
  resetFilters: () => void
  
  // UI actions
  clearError: () => void
  setSelectedProduct: (product: Product | null) => void
}

const defaultFilters: FilterState = {
  search: '',
  category: undefined,
  status: undefined,
  sortBy: 'createdAt',
  sortOrder: 'desc',
}

export const useProductStore = create<ProductState>((set, get) => ({
  // Initial state
  products: [],
  selectedProduct: null,
  isLoading: false,
  error: null,
  filters: defaultFilters,

  // Fetch all products
  fetchProducts: async () => {
    set({ isLoading: true, error: null })
    try {
      const products = await api.getProducts()
      set({ products, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'ไม่สามารถโหลดข้อมูลได้', 
        isLoading: false 
      })
    }
  },

  // Get single product
  getProduct: async (id: string) => {
    set({ isLoading: true, error: null })
    try {
      const product = await api.getProduct(id)
      set({ selectedProduct: product, isLoading: false })
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'ไม่พบสินค้า', 
        isLoading: false 
      })
    }
  },

  // Create product
  createProduct: async (input) => {
    set({ isLoading: true, error: null })
    try {
      const newProduct = await api.createProduct(input)
      set((state) => ({ 
        products: [newProduct, ...state.products],
        isLoading: false 
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'ไม่สามารถสร้างสินค้าได้', 
        isLoading: false 
      })
    }
  },

  // Update product
  updateProduct: async (id, input) => {
    set({ isLoading: true, error: null })
    try {
      const updated = await api.updateProduct(id, input)
      set((state) => ({
        products: state.products.map((p) => p.id === id ? updated : p),
        selectedProduct: state.selectedProduct?.id === id ? updated : state.selectedProduct,
        isLoading: false,
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'ไม่สามารถอัพเดทสินค้าได้', 
        isLoading: false 
      })
    }
  },

  // Delete product
  deleteProduct: async (id) => {
    set({ isLoading: true, error: null })
    try {
      await api.deleteProduct(id)
      set((state) => ({
        products: state.products.filter((p) => p.id !== id),
        selectedProduct: state.selectedProduct?.id === id ? null : state.selectedProduct,
        isLoading: false,
      }))
    } catch (error) {
      set({ 
        error: error instanceof Error ? error.message : 'ไม่สามารถลบสินค้าได้', 
        isLoading: false 
      })
    }
  },

  // Filter actions
  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    }))
  },

  resetFilters: () => {
    set({ filters: defaultFilters })
  },

  // UI actions
  clearError: () => set({ error: null }),
  setSelectedProduct: (product) => set({ selectedProduct: product }),
}))

// ==========================================
// Computed selectors (for filtered data)
// ==========================================

export const useFilteredProducts = () => {
  const products = useProductStore((state) => state.products)
  const filters = useProductStore((state) => state.filters)
  
  return products.filter((product) => {
    // Search filter
    if (filters.search) {
      const search = filters.search.toLowerCase()
      if (!product.name.toLowerCase().includes(search) &&
          !product.description.toLowerCase().includes(search)) {
        return false
      }
    }
    
    // Category filter
    if (filters.category && product.category !== filters.category) {
      return false
    }
    
    // Status filter
    if (filters.status === 'active' && !product.isActive) return false
    if (filters.status === 'inactive' && product.isActive) return false
    
    return true
  }).sort((a, b) => {
    const order = filters.sortOrder === 'asc' ? 1 : -1
    if (filters.sortBy === 'name') {
      return a.name.localeCompare(b.name) * order
    }
    if (filters.sortBy === 'price') {
      return (a.price - b.price) * order
    }
    // Default: sort by createdAt
    return (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) * order
  })
}
