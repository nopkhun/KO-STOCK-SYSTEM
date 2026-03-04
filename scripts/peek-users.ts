import { config } from "dotenv";
config({ path: ".env.local" });

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
  const pem = key.replace(/-----BEGIN PRIVATE KEY-----/g,"").replace(/-----END PRIVATE KEY-----/g,"").replace(/\s/g,"");
  const cryptoKey = await crypto.subtle.importKey("pkcs8", Buffer.from(pem, "base64"), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, new TextEncoder().encode(signing));
  const jwt = `${signing}.${b64url(sig)}`;
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }) });
  return (await res.json()).access_token;
}

async function readSheet(name: string) {
  const id  = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
  const tok = await getToken();
  const res = await fetch(`${SHEETS_BASE}/${id}/values/${encodeURIComponent(name)}`, { headers: { Authorization: `Bearer ${tok}` } });
  const { values = [] }: { values?: string[][] } = await res.json();
  if (values.length < 2) return [];
  const headers = values[0].map((h: string) => h.trim());
  return values.slice(1).map((r: string[]) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => (obj[h] = (r[i] || "").trim()));
    return obj;
  });
}

async function run() {
  const rows = await readSheet("Users");
  console.log(`Users sheet: ${rows.length} rows`);
  console.log("Headers:", rows.length > 0 ? Object.keys(rows[0]).join(", ") : "none");
  console.log("Sample rows:");
  rows.slice(0, 5).forEach((r, i) => console.log(`  [${i}]`, JSON.stringify(r)));
}

run();
