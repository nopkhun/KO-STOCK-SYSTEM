import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  validateSignature,
  replyMessage,
  createTextMessage,
  createFlexMessage,
  createStockSummaryFlex,
  createHelpMessage,
  createReportFlex,
  createQuickReplyButtons,
  type LineEvent,
  type LineWebhookBody,
} from "@/lib/line";

// Use Supabase admin client for webhook (no user cookies available)
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  try {
    // Read raw body for signature validation
    const rawBody = await request.text();
    const signature = request.headers.get("x-line-signature") || "";

    // Validate signature
    if (!validateSignature(rawBody, signature)) {
      console.error("Invalid LINE signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body: LineWebhookBody = JSON.parse(rawBody);

    // Process events in parallel
    await Promise.all(body.events.map((event) => handleEvent(event)));

    // Always return 200 OK for LINE webhook
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("LINE webhook error:", error);
    // Still return 200 to prevent LINE from retrying
    return NextResponse.json({ ok: true });
  }
}

// Webhook verification (LINE sends GET to verify URL)
export async function GET() {
  return NextResponse.json({ ok: true });
}

// ========== Event Handler ==========

async function handleEvent(event: LineEvent): Promise<void> {
  // Only handle message events
  if (event.type !== "message" || !event.message) {
    return;
  }

  const { replyToken, message } = event;

  switch (message.type) {
    case "text": {
      const text = message.text?.trim().toLowerCase() || "";
      await handleTextMessage(replyToken, text);
      break;
    }
    case "image": {
      await handleImageMessage(replyToken, message.id);
      break;
    }
    default: {
      // Send help menu for unsupported message types
      await replyMessage(replyToken, [createHelpMessage()]);
      break;
    }
  }
}

// ========== Text Message Handler ==========

async function handleTextMessage(
  replyToken: string,
  text: string
): Promise<void> {
  // Command: stock summary
  if (text === "สต็อก" || text === "stock") {
    await handleStockSummary(replyToken);
    return;
  }

  // Command: check specific item
  if (text.startsWith("เช็คสต็อก ") || text.startsWith("เช็คสต็อก")) {
    const itemName = text.replace(/^เช็คสต็อก\s*/, "").trim();
    if (itemName) {
      await handleCheckItem(replyToken, itemName);
    } else {
      await replyMessage(replyToken, [
        {
          ...createTextMessage('กรุณาระบุชื่อสินค้า เช่น "เช็คสต็อก หมูสับ"'),
          quickReply: createQuickReplyButtons(),
        },
      ]);
    }
    return;
  }

  // Command: stock in
  if (text === "รับเข้า" || text === "stock in") {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
    await replyMessage(replyToken, [
      {
        ...createTextMessage("เปิดฟอร์มรับเข้าสต็อก"),
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "uri",
                label: "เปิดฟอร์มรับเข้า",
                uri: `https://liff.line.me/${liffId}/stock-in`,
              },
            },
          ],
        },
      },
    ]);
    return;
  }

  // Command: stock out
  if (text === "เบิก" || text === "เบิกออก" || text === "stock out") {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
    await replyMessage(replyToken, [
      {
        ...createTextMessage("เปิดฟอร์มเบิกสต็อก"),
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "uri",
                label: "เปิดฟอร์มเบิก",
                uri: `https://liff.line.me/${liffId}/stock-out`,
              },
            },
          ],
        },
      },
    ]);
    return;
  }

  // Command: report
  if (text === "รายงาน" || text === "report") {
    await handleReport(replyToken);
    return;
  }

  // Default: show help
  await replyMessage(replyToken, [createHelpMessage()]);
}

// ========== Stock Summary ==========

async function handleStockSummary(replyToken: string): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Get all items with their stock levels
    const { data: items } = await supabase
      .from("items")
      .select("id, name, min_stock, unit:units(name)")
      .order("name");

    if (!items || items.length === 0) {
      await replyMessage(replyToken, [
        {
          ...createTextMessage("ยังไม่มีข้อมูลสินค้าในระบบ"),
          quickReply: createQuickReplyButtons(),
        },
      ]);
      return;
    }

    // Get inventory totals grouped by item
    const { data: inventory } = await supabase
      .from("inventory")
      .select("item_id, remaining_qty")
      .gt("remaining_qty", 0);

    // Aggregate stock per item
    const stockMap = new Map<string, number>();
    if (inventory) {
      for (const lot of inventory) {
        const current = stockMap.get(lot.item_id) || 0;
        stockMap.set(lot.item_id, current + lot.remaining_qty);
      }
    }

    // Build items with status, prioritize low/out of stock
    type ItemStatus = { name: string; qty: number; unit: string; status: "ok" | "low" | "out" };
    const itemStatuses: ItemStatus[] = items.map((item) => {
      const qty = stockMap.get(item.id) || 0;
      // Supabase join can return array or object depending on FK inference
      const unitRaw = item.unit as unknown;
      const unitName = Array.isArray(unitRaw)
        ? (unitRaw[0] as { name: string } | undefined)?.name || "-"
        : (unitRaw as { name: string } | null)?.name || "-";
      let status: "ok" | "low" | "out" = "ok";
      if (qty <= 0) {
        status = "out";
      } else if (qty <= item.min_stock) {
        status = "low";
      }
      return { name: item.name, qty, unit: unitName, status };
    });

    // Sort: out first, then low, then ok. Take top 10 alerts.
    const statusOrder = { out: 0, low: 1, ok: 2 };
    itemStatuses.sort((a, b) => statusOrder[a.status] - statusOrder[b.status]);
    const topItems = itemStatuses.slice(0, 10);

    const alertCount = itemStatuses.filter((i) => i.status !== "ok").length;
    const flexContent = createStockSummaryFlex(topItems);

    const messages = [];
    if (alertCount > 0) {
      messages.push(
        createTextMessage(`มีสินค้าต้องดูแล ${alertCount} รายการ`)
      );
    }
    messages.push({
      ...createFlexMessage("สรุปสต็อก", flexContent),
      quickReply: createQuickReplyButtons(),
    });

    await replyMessage(replyToken, messages);
  } catch (error) {
    console.error("Stock summary error:", error);
    await replyMessage(replyToken, [
      createTextMessage("เกิดข้อผิดพลาดในการดึงข้อมูลสต็อก กรุณาลองใหม่"),
    ]);
  }
}

// ========== Check Specific Item ==========

async function handleCheckItem(
  replyToken: string,
  itemName: string
): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Search for item by name (fuzzy match using ilike)
    const { data: items } = await supabase
      .from("items")
      .select("id, name, min_stock, unit:units(name)")
      .ilike("name", `%${itemName}%`)
      .limit(5);

    if (!items || items.length === 0) {
      await replyMessage(replyToken, [
        {
          ...createTextMessage(`ไม่พบสินค้า "${itemName}" ในระบบ`),
          quickReply: createQuickReplyButtons(),
        },
      ]);
      return;
    }

    // Get stock by branch for matched items
    const itemIds = items.map((i) => i.id);
    const { data: inventory } = await supabase
      .from("inventory")
      .select("item_id, branch_id, remaining_qty, branch:branches(name)")
      .in("item_id", itemIds)
      .gt("remaining_qty", 0);

    // Build response text
    const lines: string[] = [];

    for (const item of items) {
      const unitRaw = item.unit as unknown;
      const unitName = Array.isArray(unitRaw)
        ? (unitRaw[0] as { name: string } | undefined)?.name || ""
        : (unitRaw as { name: string } | null)?.name || "";
      lines.push(`[ ${item.name} ]`);

      const itemLots = (inventory || []).filter((l) => l.item_id === item.id);
      if (itemLots.length === 0) {
        lines.push("  ไม่มีสต็อก");
      } else {
        // Aggregate by branch
        const branchStock = new Map<string, { name: string; qty: number }>();
        for (const lot of itemLots) {
          const branchRaw = lot.branch as unknown;
          const branchName = Array.isArray(branchRaw)
            ? (branchRaw[0] as { name: string } | undefined)?.name || "ไม่ระบุ"
            : (branchRaw as { name: string } | null)?.name || "ไม่ระบุ";
          const existing = branchStock.get(lot.branch_id) || {
            name: branchName,
            qty: 0,
          };
          existing.qty += lot.remaining_qty;
          branchStock.set(lot.branch_id, existing);
        }
        for (const [, b] of branchStock) {
          const statusIcon =
            b.qty <= 0 ? "  " : b.qty <= item.min_stock ? "  " : "  ";
          lines.push(`${statusIcon}${b.name}: ${b.qty} ${unitName}`);
        }
      }
      lines.push("");
    }

    await replyMessage(replyToken, [
      {
        ...createTextMessage(lines.join("\n").trim()),
        quickReply: createQuickReplyButtons(),
      },
    ]);
  } catch (error) {
    console.error("Check item error:", error);
    await replyMessage(replyToken, [
      createTextMessage("เกิดข้อผิดพลาดในการค้นหาสินค้า กรุณาลองใหม่"),
    ]);
  }
}

// ========== Report Summary ==========

async function handleReport(replyToken: string): Promise<void> {
  try {
    const supabase = createAdminClient();

    // Get totals
    const [itemsRes, inventoryRes, transactionsRes] = await Promise.all([
      supabase.from("items").select("id, min_stock"),
      supabase.from("inventory").select("item_id, remaining_qty, unit_price").gt("remaining_qty", 0),
      supabase
        .from("transactions")
        .select("id")
        .gte("created_at", new Date().toISOString().split("T")[0]),
    ]);

    const items = itemsRes.data || [];
    const inventory = inventoryRes.data || [];
    const todayTransactions = transactionsRes.data || [];

    // Calculate totals
    const totalItems = items.length;
    const totalValue = inventory.reduce(
      (sum, lot) => sum + lot.remaining_qty * (lot.unit_price || 0),
      0
    );

    // Aggregate stock per item
    const stockPerItem = new Map<string, number>();
    for (const lot of inventory) {
      const current = stockPerItem.get(lot.item_id) || 0;
      stockPerItem.set(lot.item_id, current + lot.remaining_qty);
    }

    const minStockMap = new Map(items.map((i) => [i.id, i.min_stock]));
    let lowStockCount = 0;
    let outOfStockCount = 0;

    for (const item of items) {
      const qty = stockPerItem.get(item.id) || 0;
      const minStock = minStockMap.get(item.id) || 0;
      if (qty <= 0) {
        outOfStockCount++;
      } else if (qty <= minStock) {
        lowStockCount++;
      }
    }

    const flexContent = createReportFlex({
      totalItems,
      totalValue,
      lowStockCount,
      outOfStockCount,
      recentTransactions: todayTransactions.length,
    });

    await replyMessage(replyToken, [
      {
        ...createFlexMessage("รายงานสรุป", flexContent),
        quickReply: createQuickReplyButtons(),
      },
    ]);
  } catch (error) {
    console.error("Report error:", error);
    await replyMessage(replyToken, [
      createTextMessage("เกิดข้อผิดพลาดในการสร้างรายงาน กรุณาลองใหม่"),
    ]);
  }
}

// ========== Image Message Handler ==========

async function handleImageMessage(
  replyToken: string,
  messageId: string
): Promise<void> {
  // Phase 4: OCR processing will be added here
  // For now, acknowledge receipt and store message ID for later processing
  console.log("Received image message:", messageId);

  await replyMessage(replyToken, [
    {
      ...createTextMessage(
        "กำลังอ่านใบเสร็จ...\n\n(ฟีเจอร์อ่านใบเสร็จอัตโนมัติจะเปิดให้ใช้งานเร็ว ๆ นี้)"
      ),
      quickReply: createQuickReplyButtons(),
    },
  ]);
}
