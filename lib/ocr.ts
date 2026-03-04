// OCR utilities for receipt parsing via GPT-4o Vision and LINE image download

// ========== Types ==========

export interface ParsedItem {
  name: string;
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
}

export interface ParsedReceipt {
  supplier: string;
  items: ParsedItem[];
  grand_total: number;
  raw_text?: string;
}

export interface MatchedItem {
  parsed_name: string;
  matched_item_id: string | null;
  matched_item_name: string | null;
  confidence: number; // 0-1
  qty: number;
  unit: string;
  unit_price: number;
  total: number;
}

// ========== LINE Image Download ==========

/**
 * Download an image from LINE's content API using the message ID.
 * LINE stores user-sent images temporarily and serves them via this endpoint.
 * Requires LINE_CHANNEL_ACCESS_TOKEN.
 */
export async function downloadLineImage(messageId: string): Promise<Buffer> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not configured");
  }

  const url = `https://api-data.line.me/v2/bot/message/${messageId}/content`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to download LINE image: ${response.status} ${response.statusText}`
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ========== GPT-4o Vision Parsing ==========

/**
 * Send a base64-encoded image to GPT-4o Vision for Thai receipt parsing.
 * Returns structured receipt data.
 */
export async function parseReceiptWithGPT(
  imageBase64: string
): Promise<ParsedReceipt> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const systemPrompt = `You are a receipt/invoice OCR specialist for Thai food businesses.
Parse the image and extract data in this exact JSON format:
{
  "supplier": "supplier/store name",
  "items": [
    { "name": "item name in Thai", "qty": 5, "unit": "กก.", "unit_price": 120.00, "total": 600.00 }
  ],
  "grand_total": 1500.00
}

Rules:
- Extract ALL line items from the receipt
- Keep item names in Thai as they appear
- If quantity/unit not clear, use 1 and "ชิ้น"
- If unit price not shown, calculate from total/qty
- If grand total not visible, sum all item totals
- Return ONLY valid JSON, no markdown fences`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${imageBase64}`,
                detail: "high",
              },
            },
            {
              type: "text",
              text: "Parse this Thai receipt/invoice. Extract: supplier name, items list (name, qty, unit, unit_price, total), grand total. Return as JSON.",
            },
          ],
        },
      ],
      max_tokens: 2000,
      temperature: 0.1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content: string = data.choices?.[0]?.message?.content || "";

  // Parse the JSON response — GPT may wrap it in markdown fences
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("GPT response did not contain valid JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]) as ParsedReceipt;

  // Validate and normalize
  return {
    supplier: parsed.supplier || "ไม่ทราบ",
    items: (parsed.items || []).map((item) => ({
      name: item.name || "",
      qty: Number(item.qty) || 1,
      unit: item.unit || "ชิ้น",
      unit_price: Number(item.unit_price) || 0,
      total: Number(item.total) || 0,
    })),
    grand_total:
      Number(parsed.grand_total) ||
      (parsed.items || []).reduce((sum, i) => sum + (Number(i.total) || 0), 0),
  };
}

// ========== Fallback Parser ==========

/**
 * Simple regex-based fallback parser for when OpenAI is not available.
 * Not very accurate, but demonstrates the concept.
 * Expects raw text from a basic OCR or user-typed input.
 */
export function parseReceiptFallback(text: string): ParsedReceipt {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items: ParsedItem[] = [];
  let supplier = "ไม่ทราบ";
  let grandTotal = 0;

  // Try to find supplier name — usually first non-empty line or line with common keywords
  const supplierKeywords = [
    "makro",
    "แม็คโคร",
    "โลตัส",
    "lotus",
    "big c",
    "บิ๊กซี",
    "freshket",
    "ตลาด",
    "ร้าน",
    "บจก",
    "หจก",
    "co.,ltd",
  ];
  for (const line of lines.slice(0, 5)) {
    const lower = line.toLowerCase();
    if (supplierKeywords.some((kw) => lower.includes(kw))) {
      supplier = line;
      break;
    }
  }
  if (supplier === "ไม่ทราบ" && lines.length > 0) {
    supplier = lines[0]; // fallback: use first line
  }

  // Pattern: item_name qty unit @unit_price = total
  // Or: item_name qty x price total
  // Or: item_name total_price
  const itemPattern =
    /^(.+?)\s+(\d+(?:\.\d+)?)\s*(กก\.|kg|ถุง|กระป๋อง|ลัง|ขวด|ซอง|กล่อง|ชิ้น|หน่วย|แพ็ค|โหล)?\s*[x×@]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*[=]?\s*(\d+(?:,\d{3})*(?:\.\d+)?)?/i;

  // Grand total patterns
  const totalPattern =
    /(?:รวม|total|ยอด|สุทธิ|net|grand)\s*:?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/i;

  for (const line of lines) {
    // Check for grand total line
    const totalMatch = line.match(totalPattern);
    if (totalMatch) {
      grandTotal = parseFloat(totalMatch[1].replace(/,/g, ""));
      continue;
    }

    // Check for item line
    const itemMatch = line.match(itemPattern);
    if (itemMatch) {
      const name = itemMatch[1].trim();
      const qty = parseFloat(itemMatch[2]);
      const unit = itemMatch[3] || "ชิ้น";
      const priceStr = itemMatch[4]?.replace(/,/g, "") || "0";
      const totalStr = itemMatch[5]?.replace(/,/g, "") || "";

      let unitPrice = parseFloat(priceStr);
      let total = totalStr ? parseFloat(totalStr) : unitPrice * qty;

      // If only one number found, it's likely the total
      if (!totalStr && unitPrice > 0) {
        total = unitPrice * qty;
      }

      // Avoid obviously wrong parses
      if (name.length > 1 && qty > 0) {
        items.push({ name, qty, unit, unit_price: unitPrice, total });
      }
    }
  }

  // Calculate grand total from items if not found
  if (grandTotal === 0 && items.length > 0) {
    grandTotal = items.reduce((sum, item) => sum + item.total, 0);
  }

  return {
    supplier,
    items,
    grand_total: grandTotal,
    raw_text: text,
  };
}

// ========== Fuzzy Matching ==========

/**
 * Fuzzy match parsed item names against the system's item list.
 * Uses simple substring matching and Levenshtein-like scoring.
 * @param parsed - The parsed receipt
 * @param systemItems - Array of { id, name } from the items table
 */
export function matchItemsToInventory(
  parsed: ParsedReceipt,
  systemItems: Array<{ id: string; name: string }>
): MatchedItem[] {
  return parsed.items.map((parsedItem) => {
    let bestMatch: { id: string; name: string } | null = null;
    let bestScore = 0;

    const parsedLower = parsedItem.name.toLowerCase().trim();

    for (const sysItem of systemItems) {
      const sysLower = sysItem.name.toLowerCase().trim();
      let score = 0;

      // Exact match
      if (parsedLower === sysLower) {
        score = 1.0;
      }
      // One contains the other
      else if (parsedLower.includes(sysLower) || sysLower.includes(parsedLower)) {
        const longer = Math.max(parsedLower.length, sysLower.length);
        const shorter = Math.min(parsedLower.length, sysLower.length);
        score = shorter / longer;
      }
      // Word overlap
      else {
        const parsedWords = parsedLower.split(/\s+/);
        const sysWords = sysLower.split(/\s+/);
        const commonWords = parsedWords.filter((w) =>
          sysWords.some((sw) => sw.includes(w) || w.includes(sw))
        );
        if (commonWords.length > 0) {
          score =
            (commonWords.length * 2) / (parsedWords.length + sysWords.length);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = sysItem;
      }
    }

    // Only accept matches above a threshold
    const MATCH_THRESHOLD = 0.4;
    const isGoodMatch = bestScore >= MATCH_THRESHOLD;

    return {
      parsed_name: parsedItem.name,
      matched_item_id: isGoodMatch && bestMatch ? bestMatch.id : null,
      matched_item_name: isGoodMatch && bestMatch ? bestMatch.name : null,
      confidence: Math.round(bestScore * 100) / 100,
      qty: parsedItem.qty,
      unit: parsedItem.unit,
      unit_price: parsedItem.unit_price,
      total: parsedItem.total,
    };
  });
}
