-- KO-Stock-System: Supabase Schema
-- Migrated from Google Apps Script (14 Google Sheets -> 14 PostgreSQL tables)

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- ENUM TYPES
-- ===========================================
CREATE TYPE user_role AS ENUM ('master', 'admin', 'viewer');
CREATE TYPE transaction_type AS ENUM ('in', 'out', 'transfer', 'adjust');

-- ===========================================
-- 1. BRANCHES
-- ===========================================
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  is_hq BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 2. UNITS
-- ===========================================
CREATE TABLE units (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 3. CATEGORIES
-- ===========================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 4. SUPPLIERS
-- ===========================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 5. ITEMS
-- ===========================================
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  min_stock NUMERIC DEFAULT 0,
  custom_price NUMERIC,
  custom_price_unit TEXT DEFAULT 'per_unit',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 6. ITEM_SUPPLIERS (Junction table)
-- ===========================================
CREATE TABLE item_suppliers (
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  name_at_supplier TEXT DEFAULT '',
  PRIMARY KEY (item_id, supplier_id)
);

-- ===========================================
-- 7. INVENTORY (FIFO Lot Tracking)
-- ===========================================
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  lot_id TEXT NOT NULL,
  received_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  remaining_qty NUMERIC NOT NULL DEFAULT 0,
  unit_price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inventory_branch_item ON inventory(branch_id, item_id);
CREATE INDEX idx_inventory_remaining ON inventory(remaining_qty) WHERE remaining_qty > 0;

-- ===========================================
-- 8. TRANSACTIONS
-- ===========================================
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type transaction_type NOT NULL,
  item_id UUID NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  target_branch_id UUID REFERENCES branches(id) ON DELETE RESTRICT,
  amount NUMERIC NOT NULL,
  unit TEXT,
  note TEXT DEFAULT '',
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  unit_price NUMERIC,
  total_price NUMERIC,
  out_reason TEXT DEFAULT '',
  out_value NUMERIC,
  lot_id TEXT,
  performed_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_branch ON transactions(branch_id);
CREATE INDEX idx_transactions_item ON transactions(item_id);
CREATE INDEX idx_transactions_type ON transactions(type);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- ===========================================
-- 9. PROFILES (extends Supabase auth.users)
-- ===========================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'viewer',
  must_change_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 10. AUDIT_LOG
-- ===========================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- ===========================================
-- 11. MENUS
-- ===========================================
CREATE TABLE menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  note TEXT DEFAULT '',
  target_food_cost_percent NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ===========================================
-- 12. MENU_INGREDIENTS
-- ===========================================
CREATE TABLE menu_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  type TEXT DEFAULT '',
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  item_name TEXT DEFAULT '',
  unit TEXT DEFAULT '',
  unit_price_manual NUMERIC,
  qty NUMERIC DEFAULT 0
);

CREATE INDEX idx_menu_ingredients_menu ON menu_ingredients(menu_id);

-- ===========================================
-- 13. MENU_OVERHEADS
-- ===========================================
CREATE TABLE menu_overheads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  menu_id UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  label TEXT DEFAULT '',
  type TEXT DEFAULT 'fixed',
  value NUMERIC DEFAULT 0
);

CREATE INDEX idx_menu_overheads_menu ON menu_overheads(menu_id);

-- ===========================================
-- TRIGGERS: updated_at auto-update
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_branches_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_menus_updated_at
  BEFORE UPDATE ON menus
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ===========================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- ===========================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, username, role, must_change_password)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'viewer'),
    COALESCE((NEW.raw_user_meta_data->>'must_change_password')::boolean, false)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ===========================================
-- ROW LEVEL SECURITY
-- ===========================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_overheads ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read all data
CREATE POLICY "Authenticated users can read" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON branches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON units FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON item_suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON menus FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON menu_ingredients FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can read" ON menu_overheads FOR SELECT TO authenticated USING (true);

-- All authenticated users can insert/update/delete data (role checks done in app logic)
CREATE POLICY "Authenticated users can insert" ON branches FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON branches FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON branches FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON units FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON units FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON units FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON categories FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON categories FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON suppliers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON items FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON item_suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON item_suppliers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON item_suppliers FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON inventory FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON inventory FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON inventory FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON transactions FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON transactions FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can insert" ON menus FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON menus FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON menus FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON menu_ingredients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON menu_ingredients FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON menu_ingredients FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert" ON menu_overheads FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update" ON menu_overheads FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated users can delete" ON menu_overheads FOR DELETE TO authenticated USING (true);

-- Profiles: users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);

-- ===========================================
-- SEED DATA
-- ===========================================
INSERT INTO units (name) VALUES
  ('หน่วย'), ('กก.'), ('ถุง'), ('กระป๋อง'), ('ลัง'), ('ขวด'), ('ซอง'), ('กล่อง');

INSERT INTO categories (name) VALUES
  ('วัตถุดิบ'), ('ของแห้ง'), ('ผักสด'), ('เนื้อสัตว์'), ('เครื่องปรุง'), ('เครื่องดื่ม'), ('อื่นๆ');

INSERT INTO suppliers (name) VALUES
  ('Makro'), ('Go Wholesale'), ('Freshket'), ('ตลาดสดท้องถิ่น'), ('CP FreshMart');
