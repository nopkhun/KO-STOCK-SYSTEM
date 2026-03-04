// Database types matching Supabase schema

export type UserRole = 'master' | 'admin' | 'viewer';
export type TransactionType = 'in' | 'out' | 'transfer' | 'adjust';

// ========== Row Types ==========

export interface Branch {
  id: string;
  name: string;
  is_hq: boolean;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  name: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  created_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  created_at: string;
}

export interface Item {
  id: string;
  name: string;
  unit_id: string | null;
  category_id: string | null;
  min_stock: number;
  custom_price: number | null;
  custom_price_unit: string;
  created_at: string;
  updated_at: string;
}

export interface ItemWithRelations extends Item {
  unit?: Unit | null;
  category?: Category | null;
  item_suppliers?: ItemSupplier[];
}

export interface ItemSupplier {
  item_id: string;
  supplier_id: string;
  name_at_supplier: string;
}

export interface InventoryLot {
  id: string;
  branch_id: string;
  item_id: string;
  lot_id: string;
  received_date: string;
  expiry_date: string | null;
  supplier_id: string | null;
  remaining_qty: number;
  unit_price: number | null;
  created_at: string;
}

export interface InventoryLotWithRelations extends InventoryLot {
  item?: Item | null;
  branch?: Branch | null;
  supplier?: Supplier | null;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  item_id: string;
  branch_id: string;
  target_branch_id: string | null;
  amount: number;
  unit: string | null;
  note: string;
  supplier_id: string | null;
  unit_price: number | null;
  total_price: number | null;
  out_reason: string;
  out_value: number | null;
  lot_id: string | null;
  performed_by: string;
  created_at: string;
}

export interface TransactionWithRelations extends Transaction {
  item?: Item | null;
  branch?: Branch | null;
  target_branch?: Branch | null;
  supplier?: Supplier | null;
  performer?: Profile | null;
}

export interface Profile {
  id: string;
  username: string;
  role: UserRole;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  username: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  details: string | null;
  created_at: string;
}

export interface Menu {
  id: string;
  name: string;
  note: string;
  target_food_cost_percent: number | null;
  created_at: string;
  updated_at: string;
}

export interface MenuIngredient {
  id: string;
  menu_id: string;
  type: string;
  item_id: string | null;
  item_name: string;
  unit: string;
  unit_price_manual: number | null;
  qty: number;
}

export interface MenuOverhead {
  id: string;
  menu_id: string;
  label: string;
  type: string;
  value: number;
}

export interface MenuWithRelations extends Menu {
  ingredients?: MenuIngredient[];
  overheads?: MenuOverhead[];
}

// ========== Insert Types ==========

export type BranchInsert = Omit<Branch, 'id' | 'created_at' | 'updated_at'>;
export type UnitInsert = Omit<Unit, 'id' | 'created_at'>;
export type CategoryInsert = Omit<Category, 'id' | 'created_at'>;
export type SupplierInsert = Omit<Supplier, 'id' | 'created_at'>;
export type ItemInsert = Omit<Item, 'id' | 'created_at' | 'updated_at'>;
export type TransactionInsert = Omit<Transaction, 'id' | 'created_at'>;
export type MenuInsert = Omit<Menu, 'id' | 'created_at' | 'updated_at'>;
export type MenuIngredientInsert = Omit<MenuIngredient, 'id'>;
export type MenuOverheadInsert = Omit<MenuOverhead, 'id'>;

// ========== Stock Summary ==========

export interface StockSummary {
  item_id: string;
  item_name: string;
  unit_name: string;
  category_name: string;
  branch_id: string;
  branch_name: string;
  total_qty: number;
  lot_count: number;
  wac: number; // Weighted Average Cost
  total_value: number;
  min_stock: number;
  is_low: boolean;
}
