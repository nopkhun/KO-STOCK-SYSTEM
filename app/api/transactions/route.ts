import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Helper to create authenticated supabase client from request
async function createSupabaseFromRequest(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  return { supabase, response };
}

// ==================== Processors ====================

async function processStockIn(
  supabase: SupabaseClient,
  user: User,
  params: {
    branch_id: string;
    item_id: string;
    amount: number;
    unit: string | null;
    unit_price: number | null;
    supplier_id: string | null;
    expiry_date: string | null;
    note: string;
    transaction_date: string | null;
  }
) {
  const { branch_id, item_id, amount, unit, unit_price, supplier_id, expiry_date, note, transaction_date } = params;
  const received_date = transaction_date || new Date().toISOString().split("T")[0];
  const lot_id = `LOT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const { error: lotError } = await supabase.from("inventory").insert({
    branch_id,
    item_id,
    lot_id,
    received_date,
    expiry_date: expiry_date || null,
    supplier_id: supplier_id || null,
    remaining_qty: amount,
    unit_price: unit_price || null,
  });

  if (lotError) throw new Error(lotError.message);

  const txInsert: Record<string, unknown> = {
    type: "in",
    item_id,
    branch_id,
    amount,
    unit: unit || null,
    note: note || "",
    supplier_id: supplier_id || null,
    unit_price: unit_price || null,
    total_price: amount * (unit_price || 0),
    lot_id,
    performed_by: user.id,
  };
  if (transaction_date) txInsert.transaction_date = transaction_date;

  const { error: txError } = await supabase.from("transactions").insert(txInsert);
  if (txError) throw new Error(txError.message);

  return { lot_id };
}

async function processStockOut(
  supabase: SupabaseClient,
  user: User,
  params: {
    branch_id: string;
    item_id: string;
    amount: number;
    unit: string | null;
    out_reason: string;
    note: string;
    transaction_date: string | null;
    lot_deductions?: Array<{ lot_db_id: string; new_remaining: number; qty: number; unit_price: number | null }>;
  }
) {
  const { branch_id, item_id, amount, unit, out_reason, note, transaction_date, lot_deductions } = params;

  let totalValue = 0;

  if (lot_deductions && lot_deductions.length > 0) {
    // Client provided specific lot deductions
    for (const d of lot_deductions) {
      const { error } = await supabase
        .from("inventory")
        .update({ remaining_qty: d.new_remaining })
        .eq("id", d.lot_db_id);
      if (error) throw new Error(error.message);
      totalValue += d.qty * (d.unit_price || 0);
    }
  } else {
    // Server-side FIFO deduction
    const { data: lots } = await supabase
      .from("inventory")
      .select("*")
      .eq("branch_id", branch_id)
      .eq("item_id", item_id)
      .gt("remaining_qty", 0)
      .order("received_date", { ascending: true });

    if (!lots || lots.length === 0) throw new Error("ไม่มีสต็อกเพียงพอ");

    let remaining = amount;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const deductQty = Math.min(lot.remaining_qty, remaining);
      const { error: updateError } = await supabase
        .from("inventory")
        .update({ remaining_qty: lot.remaining_qty - deductQty })
        .eq("id", lot.id);
      if (updateError) throw new Error(updateError.message);
      totalValue += deductQty * (lot.unit_price || 0);
      remaining -= deductQty;
    }

    if (remaining > 0) throw new Error(`สต็อกไม่เพียงพอ ขาดอีก ${remaining}`);
  }

  const txInsert: Record<string, unknown> = {
    type: "out",
    item_id,
    branch_id,
    amount,
    unit: unit || null,
    note: note || "",
    out_reason: out_reason || "",
    out_value: totalValue,
    performed_by: user.id,
  };
  if (transaction_date) txInsert.transaction_date = transaction_date;

  const { error: txError } = await supabase.from("transactions").insert(txInsert);
  if (txError) throw new Error(txError.message);

  return { totalValue };
}

async function processTransfer(
  supabase: SupabaseClient,
  user: User,
  params: {
    branch_id: string;
    target_branch_id: string;
    item_id: string;
    amount: number;
    unit: string | null;
    note: string;
    transaction_date: string | null;
  }
) {
  const { branch_id, target_branch_id, item_id, amount, unit, note, transaction_date } = params;

  const { data: lots } = await supabase
    .from("inventory")
    .select("*")
    .eq("branch_id", branch_id)
    .eq("item_id", item_id)
    .gt("remaining_qty", 0)
    .order("received_date", { ascending: true });

  if (!lots || lots.length === 0) throw new Error("ไม่มีสต็อกเพียงพอ");

  let remaining = amount;
  let totalValue = 0;
  const transferLots: Array<{
    received_date: string;
    expiry_date: string | null;
    supplier_id: string | null;
    qty: number;
    unit_price: number | null;
  }> = [];

  for (const lot of lots) {
    if (remaining <= 0) break;
    const deductQty = Math.min(lot.remaining_qty, remaining);
    await supabase
      .from("inventory")
      .update({ remaining_qty: lot.remaining_qty - deductQty })
      .eq("id", lot.id);
    transferLots.push({
      received_date: lot.received_date,
      expiry_date: lot.expiry_date,
      supplier_id: lot.supplier_id,
      qty: deductQty,
      unit_price: lot.unit_price,
    });
    totalValue += deductQty * (lot.unit_price || 0);
    remaining -= deductQty;
  }

  if (remaining > 0) throw new Error(`สต็อกไม่เพียงพอ ขาดอีก ${remaining}`);

  for (const tl of transferLots) {
    const lot_id = `LOT-T-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    await supabase.from("inventory").insert({
      branch_id: target_branch_id,
      item_id,
      lot_id,
      received_date: tl.received_date,
      expiry_date: tl.expiry_date,
      supplier_id: tl.supplier_id,
      remaining_qty: tl.qty,
      unit_price: tl.unit_price,
    });
  }

  const txInsert: Record<string, unknown> = {
    type: "transfer",
    item_id,
    branch_id,
    target_branch_id,
    amount,
    unit: unit || null,
    note: note || "",
    performed_by: user.id,
  };
  if (transaction_date) txInsert.transaction_date = transaction_date;

  await supabase.from("transactions").insert(txInsert);

  return { totalValue };
}

// ==================== Batch Handler ====================

interface BatchItem {
  item_id: string;
  amount: number;
  unit?: string | null;
  unit_price?: number | null;
  expiry_date?: string | null;
  supplier_id?: string | null;
  out_reason?: string;
  lot_deductions?: Array<{ lot_db_id: string; new_remaining: number; qty: number; unit_price: number | null }>;
}

async function handleBatch(
  supabase: SupabaseClient,
  user: User,
  body: {
    type: string;
    branch_id: string;
    target_branch_id?: string | null;
    supplier_id?: string | null;
    transaction_date?: string | null;
    note?: string;
    out_reason?: string;
    items: BatchItem[];
  }
) {
  const { type, branch_id, target_branch_id, supplier_id, transaction_date, note, out_reason, items } = body;

  if (!branch_id) throw new Error("กรุณาเลือกสาขา");
  if (!items || items.length === 0) throw new Error("กรุณาเพิ่มรายการสินค้า");

  const results = [];

  for (const item of items) {
    if (!item.item_id) throw new Error("กรุณาเลือกสินค้าทุกรายการ");
    if (!item.amount || item.amount <= 0) throw new Error("กรุณาระบุจำนวนที่ถูกต้อง");

    if (type === "in") {
      const result = await processStockIn(supabase, user, {
        branch_id,
        item_id: item.item_id,
        amount: item.amount,
        unit: item.unit || null,
        unit_price: item.unit_price || null,
        supplier_id: item.supplier_id || supplier_id || null,
        expiry_date: item.expiry_date || null,
        note: note || "",
        transaction_date: transaction_date || null,
      });
      results.push({ item_id: item.item_id, ...result });
    } else if (type === "out") {
      const result = await processStockOut(supabase, user, {
        branch_id,
        item_id: item.item_id,
        amount: item.amount,
        unit: item.unit || null,
        out_reason: item.out_reason || out_reason || "",
        note: note || "",
        transaction_date: transaction_date || null,
        lot_deductions: item.lot_deductions,
      });
      results.push({ item_id: item.item_id, ...result });
    } else if (type === "transfer") {
      if (!target_branch_id) throw new Error("กรุณาเลือกสาขาปลายทาง");
      if (branch_id === target_branch_id) throw new Error("สาขาต้นทางและปลายทางต้องไม่ซ้ำกัน");
      const result = await processTransfer(supabase, user, {
        branch_id,
        target_branch_id,
        item_id: item.item_id,
        amount: item.amount,
        unit: item.unit || null,
        note: note || "",
        transaction_date: transaction_date || null,
      });
      results.push({ item_id: item.item_id, ...result });
    } else {
      throw new Error("Invalid transaction type");
    }
  }

  // Audit log for batch
  await supabase.from("audit_log").insert({
    user_id: user.id,
    username: user.email,
    action: `batch_${type}`,
    entity: "inventory",
    entity_id: branch_id,
    details: JSON.stringify({
      type,
      branch_id,
      target_branch_id,
      transaction_date,
      item_count: items.length,
    }),
  });

  return NextResponse.json({ success: true, results });
}

// ==================== Legacy Single Handler ====================

async function handleSingle(supabase: SupabaseClient, user: User, body: Record<string, unknown>) {
  const {
    type,
    item_id,
    branch_id,
    amount,
    note,
    supplier_id,
    unit_price,
    unit,
    expiry_date,
    target_branch_id,
    out_reason,
    lot_deductions,
    transaction_date,
  } = body as {
    type: string;
    item_id: string;
    branch_id: string;
    amount: number;
    note?: string;
    supplier_id?: string;
    unit_price?: number;
    unit?: string;
    expiry_date?: string;
    target_branch_id?: string;
    out_reason?: string;
    lot_deductions?: Array<{ lot_db_id: string; new_remaining: number; qty: number; unit_price: number | null }>;
    transaction_date?: string;
  };

  if (!type || !item_id || !branch_id || !amount || amount <= 0) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (type === "in") {
    const result = await processStockIn(supabase, user, {
      branch_id,
      item_id,
      amount,
      unit: unit || null,
      unit_price: unit_price || null,
      supplier_id: supplier_id || null,
      expiry_date: expiry_date || null,
      note: note || "",
      transaction_date: transaction_date || null,
    });
    await supabase.from("audit_log").insert({
      user_id: user.id,
      username: user.email,
      action: "stock_in",
      entity: "inventory",
      entity_id: item_id,
      details: JSON.stringify({ amount, branch_id, lot_id: result.lot_id, supplier_id, unit_price }),
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (type === "out") {
    const result = await processStockOut(supabase, user, {
      branch_id,
      item_id,
      amount,
      unit: unit || null,
      out_reason: out_reason || "",
      note: note || "",
      transaction_date: transaction_date || null,
      lot_deductions: lot_deductions as Array<{ lot_db_id: string; new_remaining: number; qty: number; unit_price: number | null }>,
    });
    await supabase.from("audit_log").insert({
      user_id: user.id,
      username: user.email,
      action: "stock_out",
      entity: "inventory",
      entity_id: item_id,
      details: JSON.stringify({ amount, branch_id, out_reason }),
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (type === "transfer") {
    if (!target_branch_id) {
      return NextResponse.json({ error: "กรุณาเลือกสาขาปลายทาง" }, { status: 400 });
    }
    if (branch_id === target_branch_id) {
      return NextResponse.json({ error: "สาขาต้นทางและปลายทางต้องไม่ซ้ำกัน" }, { status: 400 });
    }
    const result = await processTransfer(supabase, user, {
      branch_id,
      target_branch_id,
      item_id,
      amount,
      unit: unit || null,
      note: note || "",
      transaction_date: transaction_date || null,
    });
    await supabase.from("audit_log").insert({
      user_id: user.id,
      username: user.email,
      action: "transfer",
      entity: "inventory",
      entity_id: item_id,
      details: JSON.stringify({ amount, from: branch_id, to: target_branch_id }),
    });
    return NextResponse.json({ success: true, ...result });
  }

  if (type === "adjust") {
    const { actual_qty } = body as { actual_qty: number };
    const { data: lots } = await supabase
      .from("inventory")
      .select("*")
      .eq("branch_id", branch_id)
      .eq("item_id", item_id)
      .gt("remaining_qty", 0)
      .order("received_date", { ascending: true });

    const currentQty = (lots || []).reduce(
      (sum: number, l: { remaining_qty: number }) => sum + l.remaining_qty,
      0
    );
    const diff = actual_qty - currentQty;

    if (diff === 0) return NextResponse.json({ success: true, message: "No adjustment needed" });

    if (diff > 0) {
      const lot_id = `LOT-ADJ-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      await supabase.from("inventory").insert({
        branch_id,
        item_id,
        lot_id,
        received_date: new Date().toISOString().split("T")[0],
        remaining_qty: diff,
        unit_price: 0,
      });
    } else {
      let toRemove = Math.abs(diff);
      for (const lot of lots || []) {
        if (toRemove <= 0) break;
        const deductQty = Math.min(lot.remaining_qty, toRemove);
        await supabase
          .from("inventory")
          .update({ remaining_qty: lot.remaining_qty - deductQty })
          .eq("id", lot.id);
        toRemove -= deductQty;
      }
    }

    await supabase.from("transactions").insert({
      type: "adjust",
      item_id,
      branch_id,
      amount: Math.abs(diff),
      unit: unit || null,
      note:
        (note as string) ||
        `ตรวจนับสต็อก: ระบบ ${currentQty} → จริง ${actual_qty} (${diff > 0 ? "+" : ""}${diff})`,
      performed_by: user.id,
    });

    await supabase.from("audit_log").insert({
      user_id: user.id,
      username: user.email,
      action: "stocktake_adjust",
      entity: "inventory",
      entity_id: item_id,
      details: JSON.stringify({ branch_id, system_qty: currentQty, actual_qty, diff }),
    });

    return NextResponse.json({ success: true, diff });
  }

  return NextResponse.json({ error: "Invalid transaction type" }, { status: 400 });
}

// ==================== POST Handler ====================

export async function POST(request: NextRequest) {
  try {
    const { supabase } = await createSupabaseFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    // Route to batch or legacy single handler
    if (body.items && Array.isArray(body.items) && body.items.length > 0) {
      return await handleBatch(supabase, user, body);
    } else {
      return await handleSingle(supabase, user, body);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal server error";
    console.error("Transaction error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
