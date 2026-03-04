#!/usr/bin/env tsx
/**
 * Data Migration Script: Google Sheets → Supabase
 *
 * Reads data from the original Google Sheets (the GAS-based FoodStock system)
 * and migrates it into the new Supabase-backed schema.
 *
 * Sheets read: Units, Categories, Suppliers, Items, ItemSuppliers, Branches,
 *   Inventory, Transactions, Users, Menus, MenuIngredients, MenuOverheads
 *
 * Usage:
 *   npx tsx scripts/migrate-sheets-to-supabase.ts                # Dry run
 *   npx tsx scripts/migrate-sheets-to-supabase.ts --execute       # Actual migration
 *   npx tsx scripts/migrate-sheets-to-supabase.ts --execute --skip-users  # Skip user migration
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
 *   GOOGLE_SHEETS_SPREADSHEET_ID
 */

import { config } from "dotenv";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Load environment variables from .env.local
config({ path: ".env.local" });

// ========== Types ==========

interface SheetRow {
  [key: string]: string;
}

interface MigrationStats {
  table: string;
  read: number;
  inserted: number;
  skipped: number;
  errors: string[];
}

// ID mapping: old GAS ID → new Supabase UUID
interface IdMaps {
  units: Map<string, string>; // old name/id → new uuid
  categories: Map<string, string>;
  suppliers: Map<string, string>;
  items: Map<string, string>;
  branches: Map<string, string>;
  users: Map<string, string>;
}

// ========== Config ==========

const DRY_RUN = !process.argv.includes("--execute");
const SKIP_USERS = process.argv.includes("--skip-users");

// Skip flags for resuming interrupted migration
const SKIP_STEPS = {
  units: process.argv.includes("--skip-units"),
  categories: process.argv.includes("--skip-categories"),
  suppliers: process.argv.includes("--skip-suppliers"),
  branches: process.argv.includes("--skip-branches"),
  items: process.argv.includes("--skip-items"),
  itemSuppliers: process.argv.includes("--skip-item-suppliers"),
  inventory: process.argv.includes("--skip-inventory"),
};

// ========== Google Sheets Access (standalone, no lib imports) ==========

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

function base64url(input: string | ArrayBuffer): string {
  let base64: string;
  if (typeof input === "string") {
    base64 = Buffer.from(input).toString("base64");
  } else {
    base64 = Buffer.from(new Uint8Array(input)).toString("base64");
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const privateKeyRaw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!;
  const privateKey = privateKeyRaw.replace(/\\n/g, "\n");

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claim));
  const signingInput = `${header}.${payload}`;

  // Import the private key
  const pemBody = privateKey
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryDer = Buffer.from(pemBody, "base64");

  const key = await crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  const jwt = `${signingInput}.${base64url(signature)}`;

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Token request failed: ${resp.status} ${await resp.text()}`);
  }
  const data = await resp.json();
  return data.access_token;
}

async function readSheet(sheetName: string): Promise<SheetRow[]> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const token = await getAccessToken();
  const range = encodeURIComponent(sheetName);
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}`;

  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    // Sheet might not exist
    if (resp.status === 400 || errorText.includes("Unable to parse range")) {
      console.warn(`  ⚠ Sheet "${sheetName}" not found, skipping.`);
      return [];
    }
    throw new Error(`Failed to read sheet "${sheetName}": ${resp.status} ${errorText}`);
  }

  const data = await resp.json();
  const rows: string[][] = data.values || [];
  if (rows.length < 2) return []; // Only headers or empty

  const headers = rows[0].map((h: string) => h.trim());
  const result: SheetRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj: SheetRow = {};
    for (let j = 0; j < headers.length; j++) {
      obj[headers[j]] = (row[j] || "").toString().trim();
    }
    result.push(obj);
  }

  return result;
}

// ========== Migration Logic ==========

function createStats(table: string): MigrationStats {
  return { table, read: 0, inserted: 0, skipped: 0, errors: [] };
}

function log(msg: string) {
  const prefix = DRY_RUN ? "[DRY RUN]" : "[MIGRATE]";
  console.log(`${prefix} ${msg}`);
}

function logStats(stats: MigrationStats) {
  const status = stats.errors.length > 0 ? "⚠" : "✅";
  log(
    `${status} ${stats.table}: read=${stats.read}, inserted=${stats.inserted}, skipped=${stats.skipped}, errors=${stats.errors.length}`
  );
  for (const err of stats.errors.slice(0, 5)) {
    console.log(`    ❌ ${err}`);
  }
  if (stats.errors.length > 5) {
    console.log(`    ... and ${stats.errors.length - 5} more errors`);
  }
}

// Migrate simple name-based tables (Units, Categories, Suppliers)
async function migrateSimpleTable(
  supabase: SupabaseClient,
  tableName: string,
  sheetName: string,
  idMap: Map<string, string>
): Promise<MigrationStats> {
  const stats = createStats(tableName);
  const rows = await readSheet(sheetName);
  stats.read = rows.length;

  log(`Reading ${sheetName}: ${rows.length} rows`);

  for (const row of rows) {
    const oldId = row.id || row.Id || "";
    const name = row.name || row.Name || "";

    if (!name) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      log(`  Would insert ${tableName}: "${name}" (old ID: ${oldId})`);
      // In dry run, create a fake UUID for subsequent lookups
      idMap.set(oldId, `fake-uuid-${tableName}-${oldId}`);
      idMap.set(name.toLowerCase(), `fake-uuid-${tableName}-${oldId}`);
      stats.inserted++;
      continue;
    }

    // Check if already exists
    const { data: existing } = await supabase
      .from(tableName)
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      idMap.set(oldId, existing.id);
      idMap.set(name.toLowerCase(), existing.id);
      stats.skipped++;
      continue;
    }

    const { data: inserted, error } = await supabase
      .from(tableName)
      .insert({ name })
      .select("id")
      .single();

    if (error) {
      stats.errors.push(`${name}: ${error.message}`);
      continue;
    }

    idMap.set(oldId, inserted.id);
    idMap.set(name.toLowerCase(), inserted.id);
    stats.inserted++;
  }

  return stats;
}

// Migrate branches
async function migrateBranches(
  supabase: SupabaseClient,
  idMap: Map<string, string>
): Promise<MigrationStats> {
  const stats = createStats("branches");
  const rows = await readSheet("Branches");
  stats.read = rows.length;

  log(`Reading Branches: ${rows.length} rows`);

  for (const row of rows) {
    const oldId = row.id || row.Id || "";
    const name = row.name || row.Name || "";
    const isHQ = ["true", "1", "yes", "TRUE"].includes(
      row.isHQ || row.IsHQ || row.ishq || ""
    );

    if (!name) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      log(`  Would insert branch: "${name}" (HQ: ${isHQ}, old ID: ${oldId})`);
      idMap.set(oldId, `fake-uuid-branch-${oldId}`);
      idMap.set(name.toLowerCase(), `fake-uuid-branch-${oldId}`);
      stats.inserted++;
      continue;
    }

    const { data: existing } = await supabase
      .from("branches")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      idMap.set(oldId, existing.id);
      idMap.set(name.toLowerCase(), existing.id);
      stats.skipped++;
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("branches")
      .insert({ name, is_hq: isHQ })
      .select("id")
      .single();

    if (error) {
      stats.errors.push(`${name}: ${error.message}`);
      continue;
    }

    idMap.set(oldId, inserted.id);
    idMap.set(name.toLowerCase(), inserted.id);
    stats.inserted++;
  }

  return stats;
}

// Migrate items
async function migrateItems(
  supabase: SupabaseClient,
  maps: IdMaps
): Promise<MigrationStats> {
  const stats = createStats("items");
  const rows = await readSheet("Items");
  stats.read = rows.length;

  log(`Reading Items: ${rows.length} rows`);

  for (const row of rows) {
    const oldId = row.id || row.Id || "";
    const name = row.name || row.Name || "";
    const unitName = (row.unit || row.Unit || "").toLowerCase();
    const categoryName = (row.category || row.Category || "").toLowerCase();
    const minStock = parseInt(row.minStock || row.MinStock || row.minstock || "0", 10) || 0;
    const customPrice = row.customPrice || row.customprice || "";
    const customPriceUnit = row.customPriceUnit || row.custompriceunit || "บาท/หน่วย";

    if (!name) {
      stats.skipped++;
      continue;
    }

    // Resolve unit and category to UUIDs
    const unitId = maps.units.get(unitName) || maps.units.get(row.unit || "") || null;
    const categoryId =
      maps.categories.get(categoryName) || maps.categories.get(row.category || "") || null;

    if (DRY_RUN) {
      log(
        `  Would insert item: "${name}" (unit: ${unitName}→${unitId || "null"}, cat: ${categoryName}→${categoryId || "null"}, minStock: ${minStock})`
      );
      maps.items.set(oldId, `fake-uuid-item-${oldId}`);
      maps.items.set(name.toLowerCase(), `fake-uuid-item-${oldId}`);
      stats.inserted++;
      continue;
    }

    const { data: existing } = await supabase
      .from("items")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      maps.items.set(oldId, existing.id);
      maps.items.set(name.toLowerCase(), existing.id);
      stats.skipped++;
      continue;
    }

    const insertData: Record<string, unknown> = {
      name,
      unit_id: unitId,
      category_id: categoryId,
      min_stock: minStock,
      custom_price_unit: customPriceUnit,
    };
    if (customPrice && !isNaN(Number(customPrice))) {
      insertData.custom_price = Number(customPrice);
    }

    const { data: inserted, error } = await supabase
      .from("items")
      .insert(insertData)
      .select("id")
      .single();

    if (error) {
      stats.errors.push(`${name}: ${error.message}`);
      continue;
    }

    maps.items.set(oldId, inserted.id);
    maps.items.set(name.toLowerCase(), inserted.id);
    stats.inserted++;
  }

  return stats;
}

// Migrate item-supplier mappings
async function migrateItemSuppliers(
  supabase: SupabaseClient,
  maps: IdMaps
): Promise<MigrationStats> {
  const stats = createStats("item_suppliers");
  const rows = await readSheet("ItemSuppliers");
  stats.read = rows.length;

  log(`Reading ItemSuppliers: ${rows.length} rows`);

  for (const row of rows) {
    const oldItemId = row.itemId || row.ItemId || "";
    const oldSupplierId = row.supplierId || row.SupplierId || "";
    const nameAtSupplier = row.nameAtSupplier || row.NameAtSupplier || "";

    const itemId = maps.items.get(oldItemId);
    const supplierId = maps.suppliers.get(oldSupplierId);

    if (!itemId || !supplierId) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      log(
        `  Would insert item_supplier: item=${oldItemId}→${itemId}, supplier=${oldSupplierId}→${supplierId}, name="${nameAtSupplier}"`
      );
      stats.inserted++;
      continue;
    }

    const { error } = await supabase.from("item_suppliers").insert({
      item_id: itemId,
      supplier_id: supplierId,
      name_at_supplier: nameAtSupplier,
    });

    if (error) {
      if (error.code === "23505") {
        // Duplicate key — already exists
        stats.skipped++;
      } else {
        stats.errors.push(
          `${oldItemId}/${oldSupplierId}: ${error.message}`
        );
      }
      continue;
    }

    stats.inserted++;
  }

  return stats;
}

// Migrate inventory lots
async function migrateInventory(
  supabase: SupabaseClient,
  maps: IdMaps
): Promise<MigrationStats> {
  const stats = createStats("inventory");
  const rows = await readSheet("Inventory");
  stats.read = rows.length;

  log(`Reading Inventory: ${rows.length} rows`);

  for (const row of rows) {
    const oldBranchId = row.branchId || row.BranchId || "";
    const oldItemId = row.itemId || row.ItemId || "";
    const lotId = row.lotId || row.LotId || "";
    const remainingQty = parseFloat(row.remainingQty || row.RemainingQty || "0");
    const unitPrice = row.unitPrice || row.UnitPrice || "";
    const receivedDate = row.receivedDate || row.ReceivedDate || "";
    const expiryDate = row.expiryDate || row.ExpiryDate || "";
    const supplierName = (row.supplier || row.Supplier || "").toLowerCase();

    // Skip zero-qty lots
    if (remainingQty <= 0) {
      stats.skipped++;
      continue;
    }

    const branchId = maps.branches.get(oldBranchId) || maps.branches.get(oldBranchId.toLowerCase());
    const itemId = maps.items.get(oldItemId) || maps.items.get(oldItemId.toLowerCase());
    const supplierId = supplierName
      ? maps.suppliers.get(supplierName) || null
      : null;

    if (!branchId || !itemId) {
      stats.errors.push(
        `Lot ${lotId}: cannot resolve branch "${oldBranchId}" or item "${oldItemId}"`
      );
      continue;
    }

    // Parse dates — GAS may store dates in various formats
    let parsedReceivedDate = "";
    if (receivedDate) {
      try {
        const d = new Date(receivedDate);
        if (!isNaN(d.getTime())) {
          parsedReceivedDate = d.toISOString().split("T")[0];
        }
      } catch {
        parsedReceivedDate = receivedDate; // Keep as-is and hope for the best
      }
    }
    if (!parsedReceivedDate) {
      parsedReceivedDate = new Date().toISOString().split("T")[0];
    }

    let parsedExpiryDate: string | null = null;
    if (expiryDate) {
      try {
        const d = new Date(expiryDate);
        if (!isNaN(d.getTime())) {
          parsedExpiryDate = d.toISOString().split("T")[0];
        }
      } catch {
        // Ignore invalid expiry dates
      }
    }

    if (DRY_RUN) {
      log(
        `  Would insert lot: ${lotId} (branch=${oldBranchId}, item=${oldItemId}, qty=${remainingQty})`
      );
      stats.inserted++;
      continue;
    }

    // Check if lot already exists
    const { data: existing } = await supabase
      .from("inventory")
      .select("id")
      .eq("lot_id", lotId)
      .eq("branch_id", branchId)
      .eq("item_id", itemId)
      .maybeSingle();

    if (existing) {
      stats.skipped++;
      continue;
    }

    const { error } = await supabase.from("inventory").insert({
      branch_id: branchId,
      item_id: itemId,
      lot_id: lotId || `LOT-MIG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      received_date: parsedReceivedDate,
      expiry_date: parsedExpiryDate,
      supplier_id: supplierId,
      remaining_qty: remainingQty,
      unit_price: unitPrice && !isNaN(Number(unitPrice)) ? Number(unitPrice) : null,
    });

    if (error) {
      stats.errors.push(`Lot ${lotId}: ${error.message}`);
      continue;
    }

    stats.inserted++;
  }

  return stats;
}

// Migrate transactions
async function migrateTransactions(
  supabase: SupabaseClient,
  maps: IdMaps
): Promise<MigrationStats> {
  const stats = createStats("transactions");
  const rows = await readSheet("Transactions");
  stats.read = rows.length;

  log(`Reading Transactions: ${rows.length} rows`);

  for (const row of rows) {
    const oldId = row.id || row.Id || "";
    const type = (row.type || row.Type || "").toLowerCase();
    const oldItemId = row.itemId || row.ItemId || row.itemid || "";
    const oldBranchId = row.branchId || row.BranchId || row.branchid || "";
    const oldTargetBranchId = row.targetBranchId || row.TargetBranchId || "";
    const amount = parseFloat(row.amount || row.Amount || row.qty || "0");
    const unit = row.unit || row.Unit || "";
    const note = row.note || row.Note || "";
    const supplierName = (row.supplier || row.Supplier || "").toLowerCase();
    const unitPrice = row.unitPrice || row.UnitPrice || "";
    const totalPrice = row.totalPrice || row.TotalPrice || "";
    const lotId = row.lotId || row.LotId || "";
    const outReason = row.outReason || row.OutReason || "";
    const outValue = row.outValue || row.OutValue || "";
    const timestamp = row.timestamp || row.Timestamp || "";
    const performedByName = row.performedBy || row.PerformedBy || "";

    // Resolve IDs
    // Try direct old ID first, then by name in the fromBranch/toBranch fields
    const fromBranchName = (row.fromBranch || row.FromBranch || "").toLowerCase();
    const toBranchName = (row.toBranch || row.ToBranch || "").toLowerCase();

    const branchId =
      maps.branches.get(oldBranchId) ||
      maps.branches.get(oldBranchId.toLowerCase()) ||
      maps.branches.get(fromBranchName) ||
      null;

    const targetBranchId = oldTargetBranchId
      ? maps.branches.get(oldTargetBranchId) ||
        maps.branches.get(oldTargetBranchId.toLowerCase()) ||
        maps.branches.get(toBranchName) ||
        null
      : null;

    // Resolve item: try by old ID, then by item name
    const itemName = (row.itemName || row.ItemName || "").toLowerCase();
    const itemId =
      maps.items.get(oldItemId) ||
      maps.items.get(oldItemId.toLowerCase()) ||
      maps.items.get(itemName) ||
      null;

    const supplierId = supplierName
      ? maps.suppliers.get(supplierName) || null
      : null;

    // Resolve performer to user UUID
    const performedBy = performedByName
      ? maps.users.get(performedByName) ||
        maps.users.get(performedByName.toLowerCase()) ||
        null
      : null;

    if (!branchId || !itemId || !type) {
      stats.errors.push(
        `TX ${oldId}: cannot resolve branch="${oldBranchId}" or item="${oldItemId}" or missing type`
      );
      continue;
    }

    if (!["in", "out", "transfer", "adjust"].includes(type)) {
      stats.errors.push(`TX ${oldId}: invalid type "${type}"`);
      continue;
    }

    // Parse timestamp
    let createdAt: string | undefined;
    if (timestamp) {
      try {
        const d = new Date(timestamp);
        if (!isNaN(d.getTime())) {
          createdAt = d.toISOString();
        }
      } catch {
        // Ignore
      }
    }

    if (DRY_RUN) {
      log(
        `  Would insert tx: ${oldId} (type=${type}, item=${oldItemId}, branch=${oldBranchId}, amount=${amount})`
      );
      stats.inserted++;
      continue;
    }

    const insertData: Record<string, unknown> = {
      type,
      item_id: itemId,
      branch_id: branchId,
      target_branch_id: targetBranchId,
      amount,
      unit: unit || null,
      note: note || "",
      supplier_id: supplierId,
      unit_price: unitPrice && !isNaN(Number(unitPrice)) ? Number(unitPrice) : null,
      total_price: totalPrice && !isNaN(Number(totalPrice)) ? Number(totalPrice) : null,
      lot_id: lotId || null,
      out_reason: outReason || "",
      out_value: outValue && !isNaN(Number(outValue)) ? Number(outValue) : null,
      performed_by: performedBy || "00000000-0000-0000-0000-000000000000", // Placeholder if unknown
    };

    // If we have a timestamp, we need to set created_at via raw SQL or
    // accept that Supabase will set it. For simplicity, we add a note.
    if (createdAt) {
      insertData.created_at = createdAt;
    }

    const { error } = await supabase.from("transactions").insert(insertData);

    if (error) {
      stats.errors.push(`TX ${oldId}: ${error.message}`);
      continue;
    }

    stats.inserted++;
  }

  return stats;
}

// Migrate menus
async function migrateMenus(
  supabase: SupabaseClient,
  maps: IdMaps
): Promise<MigrationStats> {
  const stats = createStats("menus");
  const menuRows = await readSheet("Menus");
  const ingredientRows = await readSheet("MenuIngredients");
  const overheadRows = await readSheet("MenuOverheads");

  stats.read = menuRows.length;
  log(`Reading Menus: ${menuRows.length} rows, ${ingredientRows.length} ingredients, ${overheadRows.length} overheads`);

  const menuIdMap = new Map<string, string>(); // old menu ID → new UUID

  // Insert menus
  for (const row of menuRows) {
    const oldId = row.id || row.Id || "";
    const name = row.name || row.Name || "";
    const note = row.note || row.Note || "";
    const targetFoodCost = row.targetFoodCostPercent || row.targetfoodcostpercent || "";

    if (!name) {
      stats.skipped++;
      continue;
    }

    if (DRY_RUN) {
      log(`  Would insert menu: "${name}" (old ID: ${oldId})`);
      menuIdMap.set(oldId, `fake-uuid-menu-${oldId}`);
      stats.inserted++;
      continue;
    }

    const { data: existing } = await supabase
      .from("menus")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      menuIdMap.set(oldId, existing.id);
      stats.skipped++;
      continue;
    }

    const { data: inserted, error } = await supabase
      .from("menus")
      .insert({
        name,
        note: note || "",
        target_food_cost_percent:
          targetFoodCost && !isNaN(Number(targetFoodCost))
            ? Number(targetFoodCost)
            : null,
      })
      .select("id")
      .single();

    if (error) {
      stats.errors.push(`Menu "${name}": ${error.message}`);
      continue;
    }

    menuIdMap.set(oldId, inserted.id);
    stats.inserted++;
  }

  // Insert ingredients
  let ingInserted = 0;
  for (const row of ingredientRows) {
    const oldMenuId = row.menuId || row.MenuId || "";
    const menuId = menuIdMap.get(oldMenuId);
    if (!menuId) continue;

    const oldItemId = row.itemId || row.ItemId || "";
    const itemId = oldItemId ? maps.items.get(oldItemId) || null : null;

    const insertData = {
      menu_id: menuId,
      type: row.type || row.Type || "ingredient",
      item_id: itemId,
      item_name: row.itemName || row.ItemName || "",
      unit: row.unit || row.Unit || "",
      unit_price_manual:
        row.unitPriceManual && !isNaN(Number(row.unitPriceManual))
          ? Number(row.unitPriceManual)
          : null,
      qty: row.qty && !isNaN(Number(row.qty)) ? Number(row.qty) : 0,
    };

    if (!DRY_RUN) {
      const { error } = await supabase
        .from("menu_ingredients")
        .insert(insertData);
      if (error) {
        stats.errors.push(`Ingredient for menu ${oldMenuId}: ${error.message}`);
        continue;
      }
    }
    ingInserted++;
  }

  // Insert overheads
  let ohInserted = 0;
  for (const row of overheadRows) {
    const oldMenuId = row.menuId || row.MenuId || "";
    const menuId = menuIdMap.get(oldMenuId);
    if (!menuId) continue;

    const insertData = {
      menu_id: menuId,
      label: row.label || row.Label || "",
      type: row.type || row.Type || "fixed",
      value: row.value && !isNaN(Number(row.value)) ? Number(row.value) : 0,
    };

    if (!DRY_RUN) {
      const { error } = await supabase
        .from("menu_overheads")
        .insert(insertData);
      if (error) {
        stats.errors.push(`Overhead for menu ${oldMenuId}: ${error.message}`);
        continue;
      }
    }
    ohInserted++;
  }

  log(`  Ingredients: ${ingInserted}, Overheads: ${ohInserted}`);
  return stats;
}

// ========== Main ==========

async function main() {
  console.log("=".repeat(60));
  console.log(
    DRY_RUN
      ? "🔍 DRY RUN MODE — No data will be written"
      : "🚀 EXECUTE MODE — Data will be written to Supabase"
  );
  console.log("=".repeat(60));
  console.log();

  // Validate environment
  const requiredEnvVars = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GOOGLE_SERVICE_ACCOUNT_EMAIL",
    "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
    "GOOGLE_SHEETS_SPREADSHEET_ID",
  ];

  const missing = requiredEnvVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error("❌ Missing environment variables:", missing.join(", "));
    console.error("   Make sure .env.local is configured.");
    process.exit(1);
  }

  // Create Supabase client with service role key (bypasses RLS)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const idMaps: IdMaps = {
    units: new Map(),
    categories: new Map(),
    suppliers: new Map(),
    items: new Map(),
    branches: new Map(),
    users: new Map(),
  };

  const allStats: MigrationStats[] = [];

  // Migration order matters: reference tables first, then dependents
  try {
    // 1. Units
    if (!SKIP_STEPS.units) {
      log("── Step 1/8: Units ──");
      allStats.push(
        await migrateSimpleTable(supabase, "units", "Units", idMaps.units)
      );
    } else {
      log("── Step 1/8: Units ── (SKIPPED)");
      // Still load ID map from existing data
      const { data: units } = await supabase.from("units").select("id, name");
      if (units) for (const u of units) idMaps.units.set(u.name, u.id);
    }

    // 2. Categories
    if (!SKIP_STEPS.categories) {
      log("── Step 2/8: Categories ──");
      allStats.push(
        await migrateSimpleTable(supabase, "categories", "Categories", idMaps.categories)
      );
    } else {
      log("── Step 2/8: Categories ── (SKIPPED)");
      const { data: cats } = await supabase.from("categories").select("id, name");
      if (cats) for (const c of cats) idMaps.categories.set(c.name, c.id);
    }

    // 3. Suppliers
    if (!SKIP_STEPS.suppliers) {
      log("── Step 3/8: Suppliers ──");
      allStats.push(
        await migrateSimpleTable(supabase, "suppliers", "Suppliers", idMaps.suppliers)
      );
    } else {
      log("── Step 3/8: Suppliers ── (SKIPPED)");
      const { data: supps } = await supabase.from("suppliers").select("id, name");
      if (supps) for (const s of supps) idMaps.suppliers.set(s.name, s.id);
    }

    // 4. Branches
    if (!SKIP_STEPS.branches) {
      log("── Step 4/8: Branches ──");
      allStats.push(await migrateBranches(supabase, idMaps.branches));
    } else {
      log("── Step 4/8: Branches ── (SKIPPED)");
      const { data: brs } = await supabase.from("branches").select("id, name");
      if (brs) for (const b of brs) idMaps.branches.set(b.name, b.id);
    }

    // 5. Items (depends on units, categories)
    if (!SKIP_STEPS.items) {
      log("── Step 5/8: Items ──");
      allStats.push(await migrateItems(supabase, idMaps));
    } else {
      log("── Step 5/8: Items ── (SKIPPED)");
      const { data: items } = await supabase.from("items").select("id, name");
      if (items) for (const i of items) idMaps.items.set(i.name, i.id);
    }

    // 6. Item-Supplier mappings
    if (!SKIP_STEPS.itemSuppliers) {
      log("── Step 6/8: ItemSuppliers ──");
      allStats.push(await migrateItemSuppliers(supabase, idMaps));
    } else {
      log("── Step 6/8: ItemSuppliers ── (SKIPPED)");
    }

    // 7. Inventory lots (depends on branches, items, suppliers)
    if (!SKIP_STEPS.inventory) {
      log("── Step 7/8: Inventory ──");
      allStats.push(await migrateInventory(supabase, idMaps));
    } else {
      log("── Step 7/8: Inventory ── (SKIPPED)");
    }

    // 8. Transactions (depends on all of the above + users)
    if (!SKIP_USERS) {
      // Read Users sheet to build user map for performed_by
      log("── Reading Users sheet for performer mapping ──");
      const userRows = await readSheet("Users");
      for (const row of userRows) {
        const username = row.username || row.Username || row.name || row.Name || "";
        const oldId = row.id || row.Id || "";
        if (username) {
          // We map the username to the old ID; actual Supabase user creation
          // would require auth admin API and is complex. For now, map to a
          // placeholder. Real user migration should be done separately.
          idMaps.users.set(username, oldId);
          idMaps.users.set(username.toLowerCase(), oldId);
        }
      }
    }

    log("── Step 8/8: Transactions ──");
    allStats.push(await migrateTransactions(supabase, idMaps));

    // Bonus: Menus
    log("── Bonus: Menus ──");
    allStats.push(await migrateMenus(supabase, idMaps));
  } catch (error) {
    console.error("❌ Migration failed with error:", error);
    process.exit(1);
  }

  // Summary
  console.log();
  console.log("=".repeat(60));
  console.log("📊 MIGRATION SUMMARY");
  console.log("=".repeat(60));

  let totalRead = 0;
  let totalInserted = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const stats of allStats) {
    logStats(stats);
    totalRead += stats.read;
    totalInserted += stats.inserted;
    totalSkipped += stats.skipped;
    totalErrors += stats.errors.length;
  }

  console.log("-".repeat(60));
  console.log(
    `📈 Totals: read=${totalRead}, inserted=${totalInserted}, skipped=${totalSkipped}, errors=${totalErrors}`
  );
  console.log();

  if (DRY_RUN) {
    console.log("ℹ️  This was a DRY RUN. To actually migrate, run:");
    console.log("   npx tsx scripts/migrate-sheets-to-supabase.ts --execute");
  } else {
    console.log("✅ Migration complete!");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
