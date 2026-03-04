#!/usr/bin/env tsx
/**
 * Migrate users from Google Sheets → Supabase Auth
 *
 * Strategy:
 *   - email = username@ko-stock.local  (placeholder, can be changed later)
 *   - password = KO@<username>          (temporary, user should change after first login)
 *   - role stored in user_metadata.role AND app_metadata.role
 *   - mustChangePassword stored in user_metadata
 *
 * Usage:
 *   npx tsx scripts/migrate-users.ts           # dry run
 *   npx tsx scripts/migrate-users.ts --execute  # actual migration
 */

import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = !process.argv.includes("--execute");

// ─── Google Sheets ────────────────────────────────────────────────────────────
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_URL   = "https://oauth2.googleapis.com/token";

function b64url(input: string | ArrayBuffer): string {
  const b64 = typeof input === "string"
    ? Buffer.from(input).toString("base64")
    : Buffer.from(new Uint8Array(input)).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getToken(): Promise<string> {
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
    .replace(/\s/g, "");
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", Buffer.from(pem, "base64"),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signing));
  const jwt = `${signing}.${b64url(sig)}`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  return (await res.json()).access_token;
}

async function readSheet(name: string): Promise<Record<string, string>[]> {
  const id  = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const tok = await getToken();
  const res = await fetch(`${SHEETS_BASE}/${id}/values/${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${tok}` },
  });
  const { values = [] }: { values?: string[][] } = await res.json();
  if (values.length < 2) return [];
  const headers = values[0].map((h) => h.trim());
  return values.slice(1).map((r) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
    return obj;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log(DRY_RUN ? "🔍  DRY RUN — nothing will be written" : "🚀  EXECUTE — creating users in Supabase Auth");
  console.log("=".repeat(60));
  console.log();

  const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY", "GOOGLE_SHEETS_SPREADSHEET_ID"];
  const missing = required.filter((v) => !process.env[v]);
  if (missing.length) { console.error("❌ Missing env:", missing.join(", ")); process.exit(1); }

  // Must use service role key — only service role can create users via Admin API
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const rows = await readSheet("Users");
  console.log(`Found ${rows.length} users in Google Sheet\n`);

  // Print table header
  console.log("Username".padEnd(16) + "Role".padEnd(10) + "Email (placeholder)".padEnd(36) + "Temp Password");
  console.log("-".repeat(80));

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const username = row.username || row.Username || "";
    const role     = (row.role || row.Role || "viewer").toLowerCase();
    const mustChange = ["true", "TRUE", "1"].includes(row.mustChangePassword || "");

    if (!username) continue;

    const email    = `${username}@ko-stock.local`;
    const password = `KO@${username}`;

    console.log(
      username.padEnd(16) +
      role.padEnd(10) +
      email.padEnd(36) +
      password
    );

    if (DRY_RUN) continue;

    // Check if user already exists
    const { data: existing } = await supabase.auth.admin.listUsers();
    const alreadyExists = existing?.users?.find((u) => u.email === email);

    if (alreadyExists) {
      console.log(`  → Already exists (id: ${alreadyExists.id}), skipping`);
      skipped++;
      continue;
    }

    // Create user via Admin API
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // skip email confirmation
      user_metadata: {
        username,
        role,
        must_change_password: mustChange,
      },
      app_metadata: {
        role, // used by RLS policies
      },
    });

    if (error) {
      console.error(`  ❌ Error: ${error.message}`);
      errors.push(`${username}: ${error.message}`);
      continue;
    }

    // Also insert into public.profiles table (app-level user record)
    const { error: profileErr } = await supabase.from("profiles").insert({
      id: data.user.id,
      username,
      role,
      must_change_password: mustChange,
    });

    if (profileErr) {
      // Might fail if profiles table is not set up — not critical, role is in app_metadata
      console.warn(`  ⚠  Profile insert: ${profileErr.message}`);
    }

    console.log(`  ✅ Created (id: ${data.user.id})`);
    created++;
  }

  console.log("\n" + "=".repeat(60));

  if (DRY_RUN) {
    console.log("✅  Dry run complete.");
    console.log("    Run with --execute to create users for real.");
  } else {
    console.log(`📊  Results: created=${created}, skipped=${skipped}, errors=${errors.length}`);
    if (errors.length) {
      console.log("\nErrors:");
      errors.forEach((e) => console.log(`  ❌ ${e}`));
    }
    console.log("\n🔑  Login credentials (KEEP SAFE):");
    console.log("    Email format:    <username>@ko-stock.local");
    console.log("    Password format: KO@<username>");
    console.log("    Example: admin → admin@ko-stock.local / KO@admin");
    console.log("\n⚠️   Please ask all users to change their password after first login!");
  }
}

main().catch((err) => { console.error("Fatal:", err); process.exit(1); });
