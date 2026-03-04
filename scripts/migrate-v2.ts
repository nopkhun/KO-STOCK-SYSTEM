#!/usr/bin/env tsx
/**
 * Data Migration Script v2: Google Sheets → Supabase
 * BATCH INSERT version — much faster than v1's row-by-row approach
 *
 * Usage:
 *   npx tsx scripts/migrate-v2.ts           # Dry run
 *   npx tsx scripts/migrate-v2.ts --execute  # Actual migration
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── Config ───────────────────────────────────────────────────────────────────
const DRY_RUN = !process.argv.includes("--execute");
const BATCH_SIZE = 500; // rows per Supabase insert call

// ─── Types ────────────────────────────────────────────────────────────────────
interface Row { [key: string]: string }
interface IdMaps {
  units: Map<string, string>;
  categories: Map<string, string>;
  suppliers: Map<string, string>;
  items: Map<string, string>;
  branches: Map<string, string>;
}

// ─── Google Sheets helpers ────────────────────────────────────────────────────
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL   = "https://oauth2.googleapis.com/token";

function b64url(input: string | ArrayBuffer): string {
  const b64 =
    typeof input === "string"
      ? Buffer.from(input).toString("base64")
      : Buffer.from(new Uint8Array(input)).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getGoogleToken(): Promise<string> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key   = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const now   = Math.floor(Date.now() / 1000);
  const claim = { iss: email, scope: "https://www.googleapis.com/auth/spreadsheets.readonly", aud: TOKEN_URL, iat: now, exp: now + 3600 };

  const header  = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claim));
  const signing = `${header}.${payload}`;

  const pem = key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(pem, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signing));
  const jwt = `${signing}.${b64url(sig)}`;

  const res  = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Token failed: ${await res.text()}`);
  return (await res.json()).access_token;
}

// Cache the token so we don't re-auth on every sheet read
let _token: string | null = null;
async function token(): Promise<string> {
  if (!_token) _token = await getGoogleToken();
  return _token;
}

async function readSheet(name: string): Promise<Row[]> {
  const id  = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const url = `${SHEETS_BASE}/${id}/values/${encodeURIComponent(name)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${await token()}` } });
  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 400 || txt.includes("Unable to parse range")) {
      console.warn(`  ⚠  Sheet "${name}" not found — skipping`);
      return [];
    }
    throw new Error(`Sheet "${name}" error ${res.status}: ${txt}`);
  }
  const { values = [] }: { values?: string[][] } = await res.json();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => h.trim());
  return values.slice(1).map((r) => {
    const obj: Row = {};
    headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
    return obj;
  });
}

// ─── Supabase batch insert ────────────────────────────────────────────────────
async function batchInsert(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict?: string
): Promise<{ inserted: number; errors: string[] }> {
  if (rows.length === 0) return { inserted: 0, errors: [] };

  let inserted = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const chunk = rows.slice(i, i + BATCH_SIZE);
    const query = onConflict
      ? supabase.from(table).upsert(chunk, { onConflict, ignoreDuplicates: true })
      : supabase.from(table).insert(chunk);

    const { error } = await query;
    if (error) {
      errors.push(`chunk ${i}–${i + chunk.length}: ${error.message}`);
    } else {
      inserted += chunk.length;
    }
  }

  return { inserted, errors };
}

// ─── Parse date helper ────────────────────────────────────────────────────────
function parseDate(val: string, fallback?: string): string | null {
  if (!val) return fallback ?? null;
  try {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  } catch { /* ignore */ }
  return fallback ?? null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log(DRY_RUN ? "🔍  DRY RUN — nothing will be written" : "🚀  EXECUTE — writing to Supabase");
  console.log("=".repeat(60));

  // Validate env
  const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "GOOGLE_SHEETS_SPREADSHEET_ID"];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length) { console.error("❌ Missing env:", missing.join(", ")); process.exit(1); }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  const maps: IdMaps = {
    units: new Map(),
    categories: new Map(),
    suppliers: new Map(),
    items: new Map(),
    branches: new Map(),
  };

  // ── 1. Units ───────────────────────────────────────────────────────────────
  console.log("\n── 1/8 Units ──");
  const unitRows = await readSheet("Units");
  console.log(`  Read: ${unitRows.length}`);
  if (!DRY_RUN) {
    const payload = unitRows.filter((r) => r.name || r.Name).map((r) => ({ name: r.name || r.Name }));
    const res = await batchInsert(supabase, "units", payload, "name");
    console.log(`  Inserted/upserted: ${res.inserted}`, res.errors.length ? `Errors: ${res.errors}` : "");
  }
  // Build map from DB (works after insert OR if already existed)
  const { data: dbUnits } = await supabase.from("units").select("id, name");
  for (const u of dbUnits ?? []) {
    maps.units.set(u.name, u.id);
    maps.units.set(u.name.toLowerCase(), u.id);
  }
  // Also map old GAS IDs
  for (const r of unitRows) {
    const oldId = r.id || r.Id || "";
    const name  = r.name || r.Name || "";
    const uuid  = maps.units.get(name.toLowerCase());
    if (oldId && uuid) { maps.units.set(oldId, uuid); }
  }
  console.log(`  Map size: ${maps.units.size}`);

  // ── 2. Categories ──────────────────────────────────────────────────────────
  console.log("\n── 2/8 Categories ──");
  const catRows = await readSheet("Categories");
  console.log(`  Read: ${catRows.length}`);
  if (!DRY_RUN) {
    const payload = catRows.filter((r) => r.name || r.Name).map((r) => ({ name: r.name || r.Name }));
    const res = await batchInsert(supabase, "categories", payload, "name");
    console.log(`  Inserted/upserted: ${res.inserted}`, res.errors.length ? `Errors: ${res.errors}` : "");
  }
  const { data: dbCats } = await supabase.from("categories").select("id, name");
  for (const c of dbCats ?? []) {
    maps.categories.set(c.name, c.id);
    maps.categories.set(c.name.toLowerCase(), c.id);
  }
  for (const r of catRows) {
    const oldId = r.id || r.Id || "";
    const name  = r.name || r.Name || "";
    const uuid  = maps.categories.get(name.toLowerCase());
    if (oldId && uuid) maps.categories.set(oldId, uuid);
  }
  console.log(`  Map size: ${maps.categories.size}`);

  // ── 3. Suppliers ───────────────────────────────────────────────────────────
  console.log("\n── 3/8 Suppliers ──");
  const suppRows = await readSheet("Suppliers");
  console.log(`  Read: ${suppRows.length}`);
  if (!DRY_RUN) {
    const payload = suppRows.filter((r) => r.name || r.Name).map((r) => ({ name: r.name || r.Name }));
    const res = await batchInsert(supabase, "suppliers", payload, "name");
    console.log(`  Inserted/upserted: ${res.inserted}`, res.errors.length ? `Errors: ${res.errors}` : "");
  }
  const { data: dbSupps } = await supabase.from("suppliers").select("id, name");
  for (const s of dbSupps ?? []) {
    maps.suppliers.set(s.name, s.id);
    maps.suppliers.set(s.name.toLowerCase(), s.id);
  }
  for (const r of suppRows) {
    const oldId = r.id || r.Id || "";
    const name  = r.name || r.Name || "";
    const uuid  = maps.suppliers.get(name.toLowerCase());
    if (oldId && uuid) maps.suppliers.set(oldId, uuid);
  }
  console.log(`  Map size: ${maps.suppliers.size}`);

  // ── 4. Branches ────────────────────────────────────────────────────────────
  console.log("\n── 4/8 Branches ──");
  const branchRows = await readSheet("Branches");
  console.log(`  Read: ${branchRows.length}`);
  if (!DRY_RUN) {
    const payload = branchRows.filter((r) => r.name || r.Name).map((r) => ({
      name: r.name || r.Name,
      is_hq: ["true", "1", "yes", "TRUE"].includes(r.isHQ || r.IsHQ || r.ishq || ""),
    }));
    const res = await batchInsert(supabase, "branches", payload, "name");
    console.log(`  Inserted/upserted: ${res.inserted}`, res.errors.length ? `Errors: ${res.errors}` : "");
  }
  const { data: dbBranches } = await supabase.from("branches").select("id, name");
  for (const b of dbBranches ?? []) {
    maps.branches.set(b.name, b.id);
    maps.branches.set(b.name.toLowerCase(), b.id);
  }
  for (const r of branchRows) {
    const oldId = r.id || r.Id || "";
    const name  = r.name || r.Name || "";
    const uuid  = maps.branches.get(name.toLowerCase());
    if (oldId && uuid) maps.branches.set(oldId, uuid);
  }
  console.log(`  Map size: ${maps.branches.size}`);

  // ── 5. Items ───────────────────────────────────────────────────────────────
  console.log("\n── 5/8 Items ──");
  const itemRows = await readSheet("Items");
  console.log(`  Read: ${itemRows.length}`);
  if (!DRY_RUN) {
    const payload = itemRows
      .filter((r) => r.name || r.Name)
      .map((r) => {
        const name = r.name || r.Name;
        const unitName = r.unit || r.Unit || "";
        const catName  = r.category || r.Category || "";
        const unitId   = maps.units.get(unitName) || maps.units.get(unitName.toLowerCase()) || null;
        const catId    = maps.categories.get(catName) || maps.categories.get(catName.toLowerCase()) || null;
        const minStock = parseInt(r.minStock || r.MinStock || r.minstock || "0", 10) || 0;
        const cp       = r.customPrice || r.customprice || "";
        const cpUnit   = r.customPriceUnit || r.custompriceunit || "บาท/หน่วย";
        const rec: Record<string, unknown> = { name, unit_id: unitId, category_id: catId, min_stock: minStock, custom_price_unit: cpUnit };
        if (cp && !isNaN(Number(cp))) rec.custom_price = Number(cp);
        return rec;
      });
    const res = await batchInsert(supabase, "items", payload, "name");
    console.log(`  Inserted/upserted: ${res.inserted}`, res.errors.length ? `Errors: ${res.errors.slice(0, 3)}` : "");
  }
  const { data: dbItems } = await supabase.from("items").select("id, name");
  for (const i of dbItems ?? []) {
    maps.items.set(i.name, i.id);
    maps.items.set(i.name.toLowerCase(), i.id);
  }
  for (const r of itemRows) {
    const oldId = r.id || r.Id || "";
    const name  = r.name || r.Name || "";
    const uuid  = maps.items.get(name.toLowerCase());
    if (oldId && uuid) maps.items.set(oldId, uuid);
  }
  console.log(`  Map size: ${maps.items.size}`);

  // ── 6. ItemSuppliers ───────────────────────────────────────────────────────
  console.log("\n── 6/8 ItemSuppliers ──");
  const isRows = await readSheet("ItemSuppliers");
  console.log(`  Read: ${isRows.length}`);
  if (!DRY_RUN && isRows.length > 0) {
    const payload = isRows
      .map((r) => {
        const itemId = maps.items.get(r.itemId || r.ItemId || "") || null;
        const suppId = maps.suppliers.get(r.supplierId || r.SupplierId || "") || null;
        if (!itemId || !suppId) return null;
        return { item_id: itemId, supplier_id: suppId, name_at_supplier: r.nameAtSupplier || r.NameAtSupplier || "" };
      })
      .filter(Boolean) as Record<string, unknown>[];
    const res = await batchInsert(supabase, "item_suppliers", payload);
    console.log(`  Inserted: ${res.inserted}`, res.errors.length ? `Errors: ${res.errors}` : "");
  }

  // ── 7. Inventory ───────────────────────────────────────────────────────────
  console.log("\n── 7/8 Inventory (lots) ──");
  const invRows = await readSheet("Inventory");
  console.log(`  Read: ${invRows.length}`);

  const today = new Date().toISOString().split("T")[0];
  const invPayload = invRows
    .map((r) => {
      const qty       = parseFloat(r.remainingQty || r.RemainingQty || "0");
      if (qty <= 0) return null;

      const branchId  = maps.branches.get(r.branchId || r.BranchId || "") ||
                        maps.branches.get((r.branchId || r.BranchId || "").toLowerCase()) || null;
      const itemId    = maps.items.get(r.itemId || r.ItemId || "") ||
                        maps.items.get((r.itemId || r.ItemId || "").toLowerCase()) || null;
      if (!branchId || !itemId) return null;

      const suppName  = (r.supplier || r.Supplier || "").toLowerCase();
      const suppId    = suppName ? maps.suppliers.get(suppName) || null : null;
      const lotId     = r.lotId || r.LotId || `LOT-MIG-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const up        = r.unitPrice || r.UnitPrice || "";

      return {
        branch_id:     branchId,
        item_id:       itemId,
        lot_id:        lotId,
        received_date: parseDate(r.receivedDate || r.ReceivedDate || "", today)!,
        expiry_date:   parseDate(r.expiryDate || r.ExpiryDate || ""),
        supplier_id:   suppId,
        remaining_qty: qty,
        unit_price:    up && !isNaN(Number(up)) ? Number(up) : null,
      };
    })
    .filter(Boolean) as Record<string, unknown>[];

  console.log(`  Valid lots: ${invPayload.length} (skipped ${invRows.length - invPayload.length} zero-qty/unresolved)`);

  if (!DRY_RUN) {
    // Clear any partial data from previous runs
    const { error: delErr } = await supabase.from("inventory").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) console.warn(`  ⚠  Could not clear inventory: ${delErr.message}`);
    else console.log("  Cleared existing inventory rows");

    const res = await batchInsert(supabase, "inventory", invPayload);
    console.log(`  Inserted: ${res.inserted}${res.errors.length ? `\n  Errors: ${res.errors.slice(0, 5).join("\n  ")}` : ""}`);
  }

  // ── 8. Transactions ────────────────────────────────────────────────────────
  console.log("\n── 8/8 Transactions ──");
  const txRows = await readSheet("Transactions");
  console.log(`  Read: ${txRows.length}`);

  let txSkipped = 0;
  const txPayload = txRows
    .map((r) => {
      const type = (r.type || r.Type || "").toLowerCase();
      if (!["in", "out", "transfer", "adjust"].includes(type)) { txSkipped++; return null; }

      const oldBrId  = r.branchId || r.BranchId || r.branchid || "";
      const oldItemId = r.itemId || r.ItemId || r.itemid || "";
      const oldTgtBr  = r.targetBranchId || r.TargetBranchId || "";

      const branchId  = maps.branches.get(oldBrId) || maps.branches.get(oldBrId.toLowerCase()) ||
                        maps.branches.get((r.fromBranch || r.FromBranch || "").toLowerCase()) || null;
      const itemId    = maps.items.get(oldItemId) || maps.items.get(oldItemId.toLowerCase()) ||
                        maps.items.get((r.itemName || r.ItemName || "").toLowerCase()) || null;
      const tgtBrId   = oldTgtBr
        ? maps.branches.get(oldTgtBr) || maps.branches.get(oldTgtBr.toLowerCase()) ||
          maps.branches.get((r.toBranch || r.ToBranch || "").toLowerCase()) || null
        : null;

      if (!branchId || !itemId) { txSkipped++; return null; }

      const suppName  = (r.supplier || r.Supplier || "").toLowerCase();
      const suppId    = suppName ? maps.suppliers.get(suppName) || null : null;
      const amount    = parseFloat(r.amount || r.Amount || r.qty || "0");
      const up        = r.unitPrice || r.UnitPrice || "";
      const tp        = r.totalPrice || r.TotalPrice || "";
      const ov        = r.outValue || r.OutValue || "";
      const ts        = r.timestamp || r.Timestamp || "";

      const rec: Record<string, unknown> = {
        type,
        item_id:          itemId,
        branch_id:        branchId,
        target_branch_id: tgtBrId,
        amount,
        unit:             r.unit || r.Unit || null,
        note:             r.note || r.Note || "",
        supplier_id:      suppId,
        unit_price:       up && !isNaN(Number(up)) ? Number(up) : null,
        total_price:      tp && !isNaN(Number(tp)) ? Number(tp) : null,
        lot_id:           r.lotId || r.LotId || null,
        out_reason:       r.outReason || r.OutReason || "",
        out_value:        ov && !isNaN(Number(ov)) ? Number(ov) : null,
        performed_by:     "00000000-0000-0000-0000-000000000000", // placeholder
      };
      if (ts) {
        try {
          const d = new Date(ts);
          if (!isNaN(d.getTime())) rec.created_at = d.toISOString();
        } catch { /* ignore */ }
      }
      return rec;
    })
    .filter(Boolean) as Record<string, unknown>[];

  console.log(`  Valid: ${txPayload.length}, Skipped: ${txSkipped}`);

  if (!DRY_RUN) {
    // Clear any partial data
    const { error: delErr } = await supabase.from("transactions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (delErr) console.warn(`  ⚠  Could not clear transactions: ${delErr.message}`);
    else console.log("  Cleared existing transaction rows");

    const res = await batchInsert(supabase, "transactions", txPayload);
    console.log(`  Inserted: ${res.inserted}${res.errors.length ? `\n  Errors: ${res.errors.slice(0, 5).join("\n  ")}` : ""}`);
  }

  // ── Bonus: Menus ───────────────────────────────────────────────────────────
  console.log("\n── Bonus: Menus ──");
  const menuRows   = await readSheet("Menus");
  const ingRows    = await readSheet("MenuIngredients");
  const ohRows     = await readSheet("MenuOverheads");
  console.log(`  Menus: ${menuRows.length}, Ingredients: ${ingRows.length}, Overheads: ${ohRows.length}`);

  if (!DRY_RUN && menuRows.length > 0) {
    const menuPayload = menuRows.filter((r) => r.name || r.Name).map((r) => ({
      name: r.name || r.Name,
      note: r.note || r.Note || "",
      target_food_cost_percent: r.targetFoodCostPercent && !isNaN(Number(r.targetFoodCostPercent)) ? Number(r.targetFoodCostPercent) : null,
    }));
    await batchInsert(supabase, "menus", menuPayload, "name");

    const { data: dbMenus } = await supabase.from("menus").select("id, name");
    const menuMap = new Map<string, string>();
    for (const m of dbMenus ?? []) menuMap.set(m.name, m.id);
    for (const r of menuRows) {
      const oldId = r.id || r.Id || "";
      const uuid  = menuMap.get(r.name || r.Name || "");
      if (oldId && uuid) menuMap.set(oldId, uuid);
    }

    if (ingRows.length > 0) {
      const ingPayload = ingRows.map((r) => {
        const menuId = menuMap.get(r.menuId || r.MenuId || "");
        if (!menuId) return null;
        const itemId = r.itemId ? maps.items.get(r.itemId) || null : null;
        return {
          menu_id: menuId,
          type: r.type || r.Type || "ingredient",
          item_id: itemId,
          item_name: r.itemName || r.ItemName || "",
          unit: r.unit || r.Unit || "",
          unit_price_manual: r.unitPriceManual && !isNaN(Number(r.unitPriceManual)) ? Number(r.unitPriceManual) : null,
          qty: r.qty && !isNaN(Number(r.qty)) ? Number(r.qty) : 0,
        };
      }).filter(Boolean) as Record<string, unknown>[];
      if (ingPayload.length) await batchInsert(supabase, "menu_ingredients", ingPayload);
    }

    if (ohRows.length > 0) {
      const ohPayload = ohRows.map((r) => {
        const menuId = menuMap.get(r.menuId || r.MenuId || "");
        if (!menuId) return null;
        return {
          menu_id: menuId,
          label: r.label || r.Label || "",
          type: r.type || r.Type || "fixed",
          value: r.value && !isNaN(Number(r.value)) ? Number(r.value) : 0,
        };
      }).filter(Boolean) as Record<string, unknown>[];
      if (ohPayload.length) await batchInsert(supabase, "menu_overheads", ohPayload);
    }

    console.log("  Menus + ingredients + overheads done");
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  if (DRY_RUN) {
    console.log("✅  Dry run complete — no data written.");
    console.log("    Run with --execute to migrate for real.");
  } else {
    // Final counts
    const counts = await Promise.all([
      supabase.from("units").select("id", { count: "exact", head: true }),
      supabase.from("categories").select("id", { count: "exact", head: true }),
      supabase.from("suppliers").select("id", { count: "exact", head: true }),
      supabase.from("branches").select("id", { count: "exact", head: true }),
      supabase.from("items").select("id", { count: "exact", head: true }),
      supabase.from("inventory").select("id", { count: "exact", head: true }),
      supabase.from("transactions").select("id", { count: "exact", head: true }),
      supabase.from("menus").select("id", { count: "exact", head: true }),
    ]);
    const labels = ["units", "categories", "suppliers", "branches", "items", "inventory", "transactions", "menus"];
    console.log("📊  Final row counts in Supabase:");
    labels.forEach((l, i) => console.log(`    ${l}: ${counts[i].count}`));
    console.log("\n✅  Migration complete!");
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
