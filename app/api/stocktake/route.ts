import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// POST /api/stocktake - Save multiple stocktake adjustments
export async function POST(request: NextRequest) {
  try {
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

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { branch_id, adjustments } = body;
    // adjustments: Array<{ item_id, item_name, unit, system_qty, actual_qty }>

    if (!branch_id || !adjustments || !Array.isArray(adjustments)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const results: Array<{ item_id: string; diff: number; success: boolean }> = [];
    let adjustedCount = 0;

    for (const adj of adjustments) {
      const { item_id, unit, system_qty, actual_qty } = adj;
      const diff = actual_qty - system_qty;

      if (diff === 0) {
        results.push({ item_id, diff: 0, success: true });
        continue;
      }

      // Get current lots
      const { data: lots } = await supabase
        .from("inventory")
        .select("*")
        .eq("branch_id", branch_id)
        .eq("item_id", item_id)
        .gt("remaining_qty", 0)
        .order("received_date", { ascending: true });

      if (diff > 0) {
        // Actual > System: add stock
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
        // Actual < System: FIFO deduction
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
        note: `ตรวจนับสต็อก: ระบบ ${system_qty} → จริง ${actual_qty} (${diff > 0 ? "+" : ""}${diff})`,
        performed_by: user.id,
      });

      adjustedCount++;
      results.push({ item_id, diff, success: true });
    }

    // Audit log
    await supabase.from("audit_log").insert({
      user_id: user.id,
      username: user.email,
      action: "stocktake",
      entity: "inventory",
      details: JSON.stringify({
        branch_id,
        total_items: adjustments.length,
        adjusted_items: adjustedCount,
      }),
    });

    return NextResponse.json({
      success: true,
      total: adjustments.length,
      adjusted: adjustedCount,
      results,
    });
  } catch (error) {
    console.error("Stocktake error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
