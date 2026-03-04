import crypto from "crypto";

// ========== Types ==========

export interface LineMessage {
  type: "text" | "flex" | "image" | "sticker";
  text?: string;
  altText?: string;
  contents?: object;
  quickReply?: {
    items: QuickReplyItem[];
  };
}

export interface QuickReplyItem {
  type: "action";
  action: {
    type: "message" | "uri";
    label: string;
    text?: string;
    uri?: string;
  };
}

export interface LineEvent {
  type: "message" | "follow" | "unfollow" | "postback";
  replyToken: string;
  source: {
    type: "user" | "group" | "room";
    userId?: string;
    groupId?: string;
    roomId?: string;
  };
  timestamp: number;
  message?: {
    type: "text" | "image" | "video" | "audio" | "file" | "location" | "sticker";
    id: string;
    text?: string;
    contentProvider?: {
      type: "line" | "external";
      originalContentUrl?: string;
      previewImageUrl?: string;
    };
  };
}

export interface LineWebhookBody {
  destination: string;
  events: LineEvent[];
}

// ========== Signature Validation ==========

export function validateSignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET;
  if (!channelSecret) {
    console.error("LINE_CHANNEL_SECRET is not set");
    return false;
  }

  const hash = crypto
    .createHmac("SHA256", channelSecret)
    .update(body)
    .digest("base64");

  return hash === signature;
}

// ========== LINE Messaging API ==========

const LINE_API_BASE = "https://api.line.me/v2/bot";

function getHeaders(): Record<string, string> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export async function replyMessage(
  replyToken: string,
  messages: LineMessage[]
): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/message/reply`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ replyToken, messages }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("LINE reply error:", res.status, error);
  }
}

export async function pushMessage(
  userId: string,
  messages: LineMessage[]
): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/message/push`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ to: userId, messages }),
  });

  if (!res.ok) {
    const error = await res.text();
    console.error("LINE push error:", res.status, error);
  }
}

// ========== Message Builders ==========

export function createTextMessage(text: string): LineMessage {
  return { type: "text", text };
}

export function createFlexMessage(
  altText: string,
  contents: object
): LineMessage {
  return { type: "flex", altText, contents };
}

// Stock summary flex message with color-coded status
export function createStockSummaryFlex(
  items: Array<{ name: string; qty: number; unit: string; status: "ok" | "low" | "out" }>
): object {
  const statusColor: Record<string, string> = {
    ok: "#22C55E",
    low: "#F59E0B",
    out: "#EF4444",
  };
  const statusLabel: Record<string, string> = {
    ok: "ปกติ",
    low: "ใกล้หมด",
    out: "หมด",
  };

  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "สรุปสต็อก",
          weight: "bold",
          size: "xl",
          color: "#EA580C",
        },
        {
          type: "text",
          text: new Date().toLocaleDateString("th-TH", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
          size: "xs",
          color: "#999999",
        },
      ],
      paddingAll: "20px",
      backgroundColor: "#FFF7ED",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: items.map((item) => ({
        type: "box",
        layout: "horizontal",
        contents: [
          {
            type: "text",
            text: item.name,
            size: "sm",
            color: "#333333",
            flex: 4,
            wrap: true,
          },
          {
            type: "text",
            text: `${item.qty} ${item.unit}`,
            size: "sm",
            color: "#666666",
            flex: 3,
            align: "end",
          },
          {
            type: "text",
            text: statusLabel[item.status],
            size: "xs",
            color: statusColor[item.status],
            flex: 2,
            align: "end",
            weight: "bold",
          },
        ],
        spacing: "sm",
        margin: "md",
      })),
      paddingAll: "20px",
      spacing: "sm",
    },
    footer: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "เปิดระบบจัดการ",
            uri: getLiffUrl(),
          },
          style: "primary",
          color: "#EA580C",
          height: "sm",
        },
      ],
      paddingAll: "20px",
    },
  };
}

// Quick reply buttons for common commands
export function createQuickReplyButtons(): {
  items: QuickReplyItem[];
} {
  return {
    items: [
      {
        type: "action",
        action: { type: "message", label: "เช็คสต็อก", text: "สต็อก" },
      },
      {
        type: "action",
        action: { type: "message", label: "รับเข้า", text: "รับเข้า" },
      },
      {
        type: "action",
        action: { type: "message", label: "เบิกออก", text: "เบิก" },
      },
      {
        type: "action",
        action: { type: "message", label: "รายงาน", text: "รายงาน" },
      },
      {
        type: "action",
        action: {
          type: "uri",
          label: "เปิดแอป",
          uri: getLiffUrl(),
        },
      },
    ],
  };
}

// Build LIFF URL
function getLiffUrl(path?: string): string {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || "";
  const base = `https://liff.line.me/${liffId}`;
  return path ? `${base}${path}` : base;
}

// Help menu message
export function createHelpMessage(): LineMessage {
  const text = [
    "FoodStock Manager - คำสั่งที่ใช้ได้:",
    "",
    '"สต็อก" - ดูสรุปสต็อกที่ใกล้หมด',
    '"เช็คสต็อก [ชื่อสินค้า]" - เช็คสต็อกสินค้า',
    '"รับเข้า" - เปิดฟอร์มรับเข้าสต็อก',
    '"เบิก" - เปิดฟอร์มเบิกสต็อก',
    '"รายงาน" - ดูรายงานสรุป',
    "",
    "หรือส่งรูปใบเสร็จเพื่อบันทึกอัตโนมัติ",
  ].join("\n");

  return {
    type: "text",
    text,
    quickReply: createQuickReplyButtons(),
  };
}

// Report summary flex message
export function createReportFlex(data: {
  totalItems: number;
  totalValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  recentTransactions: number;
}): object {
  return {
    type: "bubble",
    size: "mega",
    header: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "รายงานสรุป",
          weight: "bold",
          size: "xl",
          color: "#EA580C",
        },
      ],
      paddingAll: "20px",
      backgroundColor: "#FFF7ED",
    },
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        createReportRow("จำนวนสินค้าทั้งหมด", `${data.totalItems} รายการ`),
        createReportRow("มูลค่าสต็อกรวม", `${data.totalValue.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`),
        {
          type: "separator",
          margin: "lg",
        },
        createReportRow("สินค้าใกล้หมด", `${data.lowStockCount} รายการ`, "#F59E0B"),
        createReportRow("สินค้าหมดสต็อก", `${data.outOfStockCount} รายการ`, "#EF4444"),
        {
          type: "separator",
          margin: "lg",
        },
        createReportRow("รายการเคลื่อนไหววันนี้", `${data.recentTransactions} รายการ`),
      ],
      paddingAll: "20px",
      spacing: "md",
    },
    footer: {
      type: "box",
      layout: "horizontal",
      contents: [
        {
          type: "button",
          action: {
            type: "uri",
            label: "ดูรายละเอียด",
            uri: getLiffUrl(),
          },
          style: "primary",
          color: "#EA580C",
          height: "sm",
          flex: 1,
        },
      ],
      paddingAll: "20px",
    },
  };
}

function createReportRow(label: string, value: string, valueColor?: string): object {
  return {
    type: "box",
    layout: "horizontal",
    contents: [
      {
        type: "text",
        text: label,
        size: "sm",
        color: "#666666",
        flex: 5,
      },
      {
        type: "text",
        text: value,
        size: "sm",
        color: valueColor || "#333333",
        flex: 4,
        align: "end",
        weight: "bold",
      },
    ],
  };
}
