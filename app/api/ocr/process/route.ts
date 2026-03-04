import { NextResponse, type NextRequest } from "next/server";
import {
  downloadLineImage,
  parseReceiptWithGPT,
  parseReceiptFallback,
  matchItemsToInventory,
} from "@/lib/ocr";
import { createClient } from "@supabase/supabase-js";

/**
 * POST /api/ocr/process
 *
 * Process a receipt image via OCR (GPT-4o Vision).
 * Can receive images from LINE (message ID) or a direct base64 payload.
 *
 * Body:
 *   { image_url: string, line_user_id?: string }
 *   - image_url: Either a LINE message ID (e.g., "123456789") or a data URL / public URL
 *   - line_user_id: Optional LINE user ID to send results back via push message
 *
 * Returns:
 *   { supplier, items, grand_total, matched_items }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { image_url, line_user_id } = body as {
      image_url: string;
      line_user_id?: string;
    };

    if (!image_url) {
      return NextResponse.json(
        { error: "image_url is required" },
        { status: 400 }
      );
    }

    let imageBase64: string;

    // Determine the image source
    if (/^\d+$/.test(image_url)) {
      // Pure numeric string = LINE message ID
      const imageBuffer = await downloadLineImage(image_url);
      imageBase64 = imageBuffer.toString("base64");
    } else if (image_url.startsWith("data:")) {
      // Data URL: strip the prefix
      const commaIndex = image_url.indexOf(",");
      imageBase64 = commaIndex >= 0 ? image_url.slice(commaIndex + 1) : image_url;
    } else {
      // Public URL: download it
      const imageResponse = await fetch(image_url);
      if (!imageResponse.ok) {
        return NextResponse.json(
          { error: `Failed to download image: ${imageResponse.status}` },
          { status: 400 }
        );
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      imageBase64 = Buffer.from(arrayBuffer).toString("base64");
    }

    // Parse the receipt
    let parsed;
    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (hasOpenAI) {
      try {
        parsed = await parseReceiptWithGPT(imageBase64);
      } catch (gptError) {
        console.error("[OCR] GPT-4o Vision failed, using fallback:", gptError);
        // Fallback: we can't do much without OCR text, return empty
        parsed = parseReceiptFallback("");
      }
    } else {
      // No OpenAI key — return a message indicating OCR isn't configured
      console.warn("[OCR] No OPENAI_API_KEY, using fallback parser");
      parsed = parseReceiptFallback("");
    }

    // Try to match parsed items to system inventory items
    let matchedItems: ReturnType<typeof matchItemsToInventory> = [];
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseServiceKey) {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const { data: items } = await supabase
          .from("items")
          .select("id, name");

        if (items && items.length > 0 && parsed.items.length > 0) {
          matchedItems = matchItemsToInventory(parsed, items);
        }
      }
    } catch (matchError) {
      console.error("[OCR] Item matching failed:", matchError);
    }

    // Optionally push results back to LINE user
    if (line_user_id && parsed.items.length > 0) {
      try {
        await pushOCRResultToLINE(line_user_id, parsed, matchedItems);
      } catch (lineError) {
        console.error("[OCR] LINE push failed:", lineError);
      }
    }

    return NextResponse.json({
      supplier: parsed.supplier,
      items: parsed.items,
      grand_total: parsed.grand_total,
      matched_items: matchedItems,
      method: hasOpenAI ? "gpt-4o-vision" : "fallback",
    });
  } catch (error) {
    console.error("[OCR] Processing error:", error);
    return NextResponse.json(
      {
        error: "OCR processing failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Send OCR results back to a LINE user as a Flex Message summary.
 */
async function pushOCRResultToLINE(
  userId: string,
  parsed: { supplier: string; items: Array<{ name: string; qty: number; unit: string; unit_price: number; total: number }>; grand_total: number },
  matchedItems: Array<{ parsed_name: string; matched_item_name: string | null; confidence: number }>
) {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return;

  // Build a text summary
  const itemLines = parsed.items.map((item, i) => {
    const match = matchedItems[i];
    const matchStatus =
      match?.matched_item_name
        ? `✅ → ${match.matched_item_name}`
        : "❓ ไม่พบในระบบ";
    return `${item.name} x${item.qty} ${item.unit} @${item.unit_price} = ${item.total}\n  ${matchStatus}`;
  });

  const message = [
    `📋 ผลการอ่านใบเสร็จ`,
    `🏪 ร้าน: ${parsed.supplier}`,
    ``,
    ...itemLines,
    ``,
    `💰 รวมทั้งสิ้น: ${parsed.grand_total.toLocaleString("th-TH")} บาท`,
    ``,
    `ต้องการบันทึกรับสต็อกหรือไม่?`,
    `ตอบ "บันทึก" เพื่อยืนยัน`,
  ].join("\n");

  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: userId,
      messages: [{ type: "text", text: message }],
    }),
  });
}
