import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

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
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );
  return { supabase, response };
}

// POST /api/transactions - Create a new transaction with FIFO
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
    const { type, item_id, branch_id, amount, note, supplier_id, unit_price, unit, expiry_date, target_branch_id, out_reason, lot_deductions } = body;

    // Validation
    if (!type || !item_id || !branch_id || !amount || amount <= 0) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (type === "in") {
      // STOCK IN: Create new lot + transaction
      const lot_id = `LOT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const received_date = new Date().toISOString().split("T")[0];

      // Insert inventory lot
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

      if (lotError) {
        return NextResponse.json({ error: lotError.message }, { status: 500 });
      }

      // Insert transaction record
      const { error: txError } = await supabase.from("transactions").insert({
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
      });

      if (txError) {
        return NextResponse.json({ error: txError.message }, { status: 500 });
      }

      // Auto-populate item_suppliers when supplier is provided
      if (supplier_id) {
        await supabase
          .from("item_suppliers")
          .upsert(
            { item_id, supplier_id, name_at_supplier: "" },
            { onConflict: "item_id,supplier_id", ignoreDuplicates: true }
          );
      }

      // Audit log
      await supabase.from("audit_log").insert({
        user_id: user.id,
        username: user.email,
        action: "stock_in",
        entity: "inventory",
        entity_id: item_id,
        details: JSON.stringify({ amount, branch_id, lot_id, supplier_id, unit_price }),
      });

      return NextResponse.json({ success: true, lot_id });
    }

    if (type === "out") {
      // STOCK OUT: FIFO deduction from oldest lots
      if (!lot_deductions || lot_deductions.length === 0) {
        // Client didn't provide lot deductions, compute server-side FIFO
        const { data: lots } = await supabase
          .from("inventory")
          .select("*")
          .eq("branch_id", branch_id)
          .eq("item_id", item_id)
          .gt("remaining_qty", 0)
          .order("received_date", { ascending: true });

        if (!lots || lots.length === 0) {
          return NextResponse.json({ error: "ไม่มีสต็อกเพียงพอ" }, { status: 400 });
        }

        let remaining = amount;
        let totalValue = 0;
        const deductions: Array<{ lot_id: string; qty: number; value: number }> = [];

        for (const lot of lots) {
          if (remaining <= 0) break;
          const deductQty = Math.min(lot.remaining_qty, remaining);
          const value = deductQty * (lot.unit_price || 0);

          // Update lot
          const { error: updateError } = await supabase
            .from("inventory")
            .update({ remaining_qty: lot.remaining_qty - deductQty })
            .eq("id", lot.id);

          if (updateError) {
            return NextResponse.json({ error: updateError.message }, { status: 500 });
          }

          deductions.push({ lot_id: lot.lot_id, qty: deductQty, value });
          totalValue += value;
          remaining -= deductQty;
        }

        if (remaining > 0) {
          return NextResponse.json({ error: `สต็อกไม่เพียงพอ ขาดอีก ${remaining}` }, { status: 400 });
        }

        // Insert transaction
        const { error: txError } = await supabase.from("transactions").insert({
          type: "out",
          item_id,
          branch_id,
          amount,
          unit: unit || null,
          note: note || "",
          out_reason: out_reason || "",
          out_value: totalValue,
          performed_by: user.id,
        });

        if (txError) {
          return NextResponse.json({ error: txError.message }, { status: 500 });
        }

        await supabase.from("audit_log").insert({
          user_id: user.id,
          username: user.email,
          action: "stock_out",
          entity: "inventory",
          entity_id: item_id,
          details: JSON.stringify({ amount, branch_id, out_reason, deductions }),
        });

        return NextResponse.json({ success: true, deductions, totalValue });
      } else {
        // Client provided specific lot deductions
        let totalValue = 0;

        for (const d of lot_deductions) {
          const { error } = await supabase
            .from("inventory")
            .update({ remaining_qty: d.new_remaining })
            .eq("id", d.lot_db_id);

          if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
          }

          totalValue += d.qty * (d.unit_price || 0);
        }

        const { error: txError } = await supabase.from("transactions").insert({
          type: "out",
          item_id,
          branch_id,
          amount,
          unit: unit || null,
          note: note || "",
          out_reason: out_reason || "",
          out_value: totalValue,
          performed_by: user.id,
        });

        if (txError) {
          return NextResponse.json({ error: txError.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, totalValue });
      }
    }

    if (type === "transfer") {
      // TRANSFER: FIFO deduct from source, create lot at target
      if (!target_branch_id) {
        return NextResponse.json({ error: "กรุณาเลือกสาขาปลายทาง" }, { status: 400 });
      }

      const { data: lots } = await supabase
        .from("inventory")
        .select("*")
        .eq("branch_id", branch_id)
        .eq("item_id", item_id)
        .gt("remaining_qty", 0)
        .order("received_date", { ascending: true });

      if (!lots || lots.length === 0) {
        return NextResponse.json({ error: "ไม่มีสต็อกเพียงพอ" }, { status: 400 });
      }

      let remaining = amount;
      let totalValue = 0;
      const transferLots: Array<{ received_date: string; expiry_date: string | null; supplier_id: string | null; qty: number; unit_price: number | null }> = [];

      for (const lot of lots) {
        if (remaining <= 0) break;
        const deductQty = Math.min(lot.remaining_qty, remaining);
        const value = deductQty * (lot.unit_price || 0);

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

        totalValue += value;
        remaining -= deductQty;
      }

      if (remaining > 0) {
        return NextResponse.json({ error: `สต็อกไม่เพียงพอ ขาดอีก ${remaining}` }, { status: 400 });
      }

      // Create lots at target branch
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

      // Insert transaction
      await supabase.from("transactions").insert({
        type: "transfer",
        item_id,
        branch_id,
        target_branch_id,
        amount,
        unit: unit || null,
        note: note || "",
        performed_by: user.id,
      });

      await supabase.from("audit_log").insert({
        user_id: user.id,
        username: user.email,
        action: "transfer",
        entity: "inventory",
        entity_id: item_id,
        details: JSON.stringify({ amount, from: branch_id, to: target_branch_id }),
      });

      return NextResponse.json({ success: true, totalValue });
    }

    if (type === "adjust") {
      // STOCKTAKE ADJUST: Set stock to exact amount
      const { actual_qty } = body;

      // Get current stock
      const { data: lots } = await supabase
        .from("inventory")
        .select("*")
        .eq("branch_id", branch_id)
        .eq("item_id", item_id)
        .gt("remaining_qty", 0)
        .order("received_date", { ascending: true });

      const currentQty = (lots || []).reduce((sum: number, l: { remaining_qty: number }) => sum + l.remaining_qty, 0);
      const diff = actual_qty - currentQty;

      if (diff === 0) {
        return NextResponse.json({ success: true, message: "No adjustment needed" });
      }

      if (diff > 0) {
        // Actual > System = need to add stock
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
        // Actual < System = need to remove stock (FIFO deduction)
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

      // Insert adjust transaction
      await supabase.from("transactions").insert({
        type: "adjust",
        item_id,
        branch_id,
        amount: Math.abs(diff),
        unit: unit || null,
        note: note || `ตรวจนับสต็อก: ระบบ ${currentQty} → จริง ${actual_qty} (${diff > 0 ? "+" : ""}${diff})`,
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
  } catch (error) {
    console.error("Transaction error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
