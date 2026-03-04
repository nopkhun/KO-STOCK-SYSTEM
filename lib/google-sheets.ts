// Google Sheets API v4 client using raw REST calls
// Edge-compatible: uses crypto.subtle for JWT signing instead of jsonwebtoken

const SHEETS_API_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPES = "https://www.googleapis.com/auth/spreadsheets";

// ========== Types ==========

interface GoogleAuth {
  email: string;
  privateKey: string;
  spreadsheetId: string;
}

interface JWTClaim {
  iss: string;
  scope: string;
  aud: string;
  iat: number;
  exp: number;
}

// ========== Auth ==========

/**
 * Create auth config from environment variables.
 * The private key in env uses literal "\\n" — we convert to real newlines.
 */
export function getGoogleAuth(): GoogleAuth {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!email || !privateKey || !spreadsheetId) {
    throw new Error(
      "Missing Google Sheets environment variables. " +
        "Required: GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY, GOOGLE_SHEETS_SPREADSHEET_ID"
    );
  }

  return {
    email,
    // Handle the private key format: env may contain literal \\n or real \n
    privateKey: privateKey.replace(/\\n/g, "\n"),
    spreadsheetId,
  };
}

/**
 * Convert a PEM-encoded RSA private key to a CryptoKey for signing.
 * Works in Edge Runtime (crypto.subtle).
 */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  // Strip PEM headers and whitespace
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/-----BEGIN RSA PRIVATE KEY-----/g, "")
    .replace(/-----END RSA PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

/**
 * Base64url encode (no padding, URL-safe).
 */
function base64url(input: string | ArrayBuffer): string {
  let base64: string;
  if (typeof input === "string") {
    base64 = btoa(input);
  } else {
    const bytes = new Uint8Array(input);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(binary);
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Get an OAuth2 access token by creating and signing a JWT,
 * then exchanging it at Google's token endpoint.
 */
export async function getAccessToken(): Promise<string> {
  const auth = getGoogleAuth();
  const now = Math.floor(Date.now() / 1000);

  const claim: JWTClaim = {
    iss: auth.email,
    scope: SCOPES,
    aud: GOOGLE_TOKEN_URL,
    iat: now,
    exp: now + 3600, // 1 hour
  };

  // Build JWT: header.payload.signature
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify(claim));
  const signingInput = `${header}.${payload}`;

  const key = await importPrivateKey(auth.privateKey);
  const encoder = new TextEncoder();
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(signingInput)
  );

  const jwt = `${signingInput}.${base64url(signature)}`;

  // Exchange JWT for access token
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Google OAuth token request failed: ${tokenResponse.status} ${errorText}`);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
}

// ========== Sheets Operations ==========

/**
 * Append a single row to a Google Sheet tab.
 */
export async function appendRow(
  sheetName: string,
  values: string[]
): Promise<void> {
  const auth = getGoogleAuth();
  const token = await getAccessToken();
  const range = encodeURIComponent(`${sheetName}!A:Z`);
  const url = `${SHEETS_API_BASE}/${auth.spreadsheetId}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [values],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets appendRow failed: ${response.status} ${errorText}`);
  }
}

/**
 * Read data from a Google Sheet tab.
 * Returns a 2D array of strings. First row is headers.
 * @param sheetName - The sheet tab name
 * @param range - Optional A1 range within the sheet (e.g., "A1:F100"). Defaults to all data.
 */
export async function getSheetData(
  sheetName: string,
  range?: string
): Promise<string[][]> {
  const auth = getGoogleAuth();
  const token = await getAccessToken();
  const fullRange = range ? `${sheetName}!${range}` : sheetName;
  const encodedRange = encodeURIComponent(fullRange);
  const url = `${SHEETS_API_BASE}/${auth.spreadsheetId}/values/${encodedRange}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets getSheetData failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return (data.values as string[][]) || [];
}

/**
 * Update a specific cell or range in a Google Sheet.
 * @param sheetName - The sheet tab name
 * @param range - A1 notation for the cell(s), e.g., "A1" or "B2:C3"
 * @param value - The value to write
 */
export async function updateCell(
  sheetName: string,
  range: string,
  value: string
): Promise<void> {
  const auth = getGoogleAuth();
  const token = await getAccessToken();
  const fullRange = encodeURIComponent(`${sheetName}!${range}`);
  const url = `${SHEETS_API_BASE}/${auth.spreadsheetId}/values/${fullRange}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      values: [[value]],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Sheets updateCell failed: ${response.status} ${errorText}`);
  }
}

// ========== Data Formatting ==========

/**
 * Map of Supabase table names to their Google Sheet column order.
 * Used to format records before appending to sheets.
 */
const TABLE_COLUMN_MAP: Record<string, string[]> = {
  transactions: [
    "id",
    "created_at",
    "type",
    "item_id",
    "branch_id",
    "target_branch_id",
    "amount",
    "unit",
    "note",
    "supplier_id",
    "unit_price",
    "total_price",
    "performed_by",
    "out_reason",
    "out_value",
    "lot_id",
  ],
  inventory: [
    "id",
    "branch_id",
    "item_id",
    "lot_id",
    "received_date",
    "expiry_date",
    "supplier_id",
    "remaining_qty",
    "unit_price",
    "created_at",
  ],
  items: [
    "id",
    "name",
    "unit_id",
    "category_id",
    "min_stock",
    "custom_price",
    "custom_price_unit",
    "created_at",
    "updated_at",
  ],
  branches: ["id", "name", "is_hq", "created_at", "updated_at"],
};

/**
 * Format a Supabase record into an array of string values
 * matching the expected Google Sheet column order for a given table.
 * @param tableName - The Supabase table name
 * @param operation - The operation type: INSERT, UPDATE, DELETE
 * @param record - The record data
 */
export function createSyncPayload(
  tableName: string,
  operation: string,
  record: Record<string, unknown>
): string[] {
  const columns = TABLE_COLUMN_MAP[tableName];

  if (!columns) {
    // For unmapped tables, use a generic format: timestamp, operation, table, JSON
    return [
      new Date().toISOString(),
      operation,
      tableName,
      JSON.stringify(record),
    ];
  }

  return columns.map((col) => {
    const val = record[col];
    if (val === null || val === undefined) return "";
    if (typeof val === "object") return JSON.stringify(val);
    return String(val);
  });
}

/**
 * Get the Google Sheet tab name for a Supabase table.
 */
export function getSheetNameForTable(tableName: string): string {
  const map: Record<string, string> = {
    transactions: "Transactions",
    inventory: "Inventory",
    items: "Items",
    branches: "Branches",
    units: "Units",
    categories: "Categories",
    suppliers: "Suppliers",
    item_suppliers: "ItemSuppliers",
    menus: "Menus",
    menu_ingredients: "MenuIngredients",
    menu_overheads: "MenuOverheads",
  };
  return map[tableName] || tableName;
}
