import { NextResponse, type NextRequest } from "next/server";
import {
  appendRow,
  createSyncPayload,
  getSheetNameForTable,
} from "@/lib/google-sheets";

// Supabase webhook payload shape
interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  record: Record<string, unknown> | null;
  old_record: Record<string, unknown> | null;
}

// Tables we sync to Google Sheets
const SYNCED_TABLES = new Set([
  "transactions",
  "inventory",
  "items",
  "branches",
  "units",
  "categories",
  "suppliers",
]);

/**
 * POST /api/sync/sheets
 *
 * Called by Supabase Database Webhooks when data changes.
 * Supabase setup:
 *   - URL: https://your-domain.com/api/sync/sheets
 *   - Method: POST
 *   - Header: X-Webhook-Secret = <SUPABASE_WEBHOOK_SECRET env>
 *   - Events: INSERT, UPDATE, DELETE on selected tables
 *
 * Returns 200 immediately to avoid blocking Supabase.
 * Errors are logged but never cause a non-200 response.
 */
export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    const webhookSecret = process.env.SUPABASE_WEBHOOK_SECRET;
    if (webhookSecret) {
      const headerSecret = request.headers.get("X-Webhook-Secret");
      if (headerSecret !== webhookSecret) {
        console.error("[Sheets Sync] Invalid webhook secret");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const payload: WebhookPayload = await request.json();
    const { type, table, record, old_record } = payload;

    // Skip tables we don't sync
    if (!SYNCED_TABLES.has(table)) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const sheetName = getSheetNameForTable(table);

    if (type === "INSERT" && record) {
      // Append the new record as a row in the corresponding sheet
      const values = createSyncPayload(table, "INSERT", record);
      await appendRow(sheetName, values);
    } else if (type === "UPDATE" && record) {
      // For updates, log to a "ChangeLog" sheet with both old and new values.
      // We don't modify existing rows in sheets (append-only is simpler and safer).
      const logRow = [
        new Date().toISOString(),
        "UPDATE",
        table,
        record.id ? String(record.id) : "",
        JSON.stringify(old_record || {}),
        JSON.stringify(record),
      ];
      await appendRow("ChangeLog", logRow);
    } else if (type === "DELETE" && old_record) {
      // Log deletions to ChangeLog
      const logRow = [
        new Date().toISOString(),
        "DELETE",
        table,
        old_record.id ? String(old_record.id) : "",
        JSON.stringify(old_record),
        "",
      ];
      await appendRow("ChangeLog", logRow);
    }

    return NextResponse.json({ ok: true, type, table });
  } catch (error) {
    // Always return 200 to avoid Supabase retrying webhooks indefinitely.
    // Log the error for debugging.
    console.error("[Sheets Sync] Error:", error);
    return NextResponse.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
