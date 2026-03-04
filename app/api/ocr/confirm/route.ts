import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Item payload from OCR confirmation
interface ConfirmItem {
  item_id: string;
  qty: number;
  unit_price: number;
  supplier_id?: string;
  expiry_date?: string;
}

interface ConfirmBody {
  branch_id: string;
  items: ConfirmItem[];
}

/**
 * Helper to create authenticated supabase client from request cookies.
 */
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

/**
 * POST /api/ocr/confirm
 *
 * After OCR parses a receipt, the user confirms which items to stock in.
 * Creates stock-in transactions for each confirmed item.
 *
 * Body:
 *   {
 *     branch_id: string,
 *     items: Array<{ item_id, qty, unit_price, supplier_id?, expiry_date? }>
 *   }
 *
 * Returns:
 *   { success_count, failure_count, results: Array<{ item_id, success, lot_id?, error? }> }
 */
export async function POST(request: NextRequest) {
  try {
    const { supabase } = await createSupabaseFromRequest(request);

    // Verify user auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: ConfirmBody = await request.json();
    const { branch_id, items } = body;

    // Validate input
    if (!branch_id) {
      return NextResponse.json(
        { error: "branch_id is required" },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "items array is required and must not be empty" },
        { status: 400 }
      );
    }

    // Verify branch exists
    const { data: branch } = await supabase
      .from("branches")
      .select("id")
      .eq("id", branch_id)
      .single();

    if (!branch) {
      return NextResponse.json(
        { error: "Branch not found" },
        { status: 404 }
      );
    }

    // Process each item as a stock-in transaction
    const results: Array<{
      item_id: string;
      success: boolean;
      lot_id?: string;
      error?: string;
    }> = [];

    const receivedDate = new Date().toISOString().split("T")[0];

    // Fetch item details to get unit info
    const itemIds = items.map((i) => i.item_id);
    const { data: itemDetails } = await supabase
      .from("items")
      .select("id, name, unit_id, units:unit_id(name)")
      .in("id", itemIds);

    const itemMap = new Map(
      (itemDetails || []).map((item) => [item.id, item])
    );

    for (const item of items) {
      try {
        // Validate required fields per item
        if (!item.item_id || !item.qty || item.qty <= 0) {
          results.push({
            item_id: item.item_id || "unknown",
            success: false,
            error: "Invalid item_id or qty",
          });
          continue;
        }

        // Verify item exists
        const itemDetail = itemMap.get(item.item_id);
        if (!itemDetail) {
          results.push({
            item_id: item.item_id,
            success: false,
            error: "Item not found in system",
          });
          continue;
        }

        // Generate lot ID
        const lotId = `LOT-OCR-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

        // Insert inventory lot
        const { error: lotError } = await supabase.from("inventory").insert({
          branch_id,
          item_id: item.item_id,
          lot_id: lotId,
          received_date: receivedDate,
          expiry_date: item.expiry_date || null,
          supplier_id: item.supplier_id || null,
          remaining_qty: item.qty,
          unit_price: item.unit_price || null,
        });

        if (lotError) {
          results.push({
            item_id: item.item_id,
            success: false,
            error: lotError.message,
          });
          continue;
        }

        // Get unit name for transaction record
        const unitName =
          (itemDetail as Record<string, unknown>).units &&
          typeof (itemDetail as Record<string, unknown>).units === "object"
            ? ((itemDetail as Record<string, unknown>).units as { name: string })
                .name
            : null;

        // Insert transaction record
        const { error: txError } = await supabase
          .from("transactions")
          .insert({
            type: "in",
            item_id: item.item_id,
            branch_id,
            amount: item.qty,
            unit: unitName,
            note: "รับเข้าจาก OCR ใบเสร็จ",
            supplier_id: item.supplier_id || null,
            unit_price: item.unit_price || null,
            total_price: item.qty * (item.unit_price || 0),
            lot_id: lotId,
            performed_by: user.id,
          });

        if (txError) {
          // Lot was created but transaction failed — log but continue
          console.error(
            `[OCR Confirm] Transaction insert failed for item ${item.item_id}:`,
            txError
          );
          results.push({
            item_id: item.item_id,
            success: false,
            lot_id: lotId,
            error: `Lot created but transaction failed: ${txError.message}`,
          });
          continue;
        }

        // Audit log
        await supabase.from("audit_log").insert({
          user_id: user.id,
          username: user.email,
          action: "stock_in_ocr",
          entity: "inventory",
          entity_id: item.item_id,
          details: JSON.stringify({
            qty: item.qty,
            branch_id,
            lot_id: lotId,
            supplier_id: item.supplier_id,
            unit_price: item.unit_price,
            source: "ocr_receipt",
          }),
        });

        results.push({
          item_id: item.item_id,
          success: true,
          lot_id: lotId,
        });
      } catch (itemError) {
        console.error(
          `[OCR Confirm] Error processing item ${item.item_id}:`,
          itemError
        );
        results.push({
          item_id: item.item_id,
          success: false,
          error:
            itemError instanceof Error
              ? itemError.message
              : "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success_count: successCount,
      failure_count: failureCount,
      results,
    });
  } catch (error) {
    console.error("[OCR Confirm] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to confirm OCR items",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
