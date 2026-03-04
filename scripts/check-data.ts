import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function check() {
  const [inv, tx, items, branches] = await Promise.all([
    supabase.from("inventory").select("id", { count: "exact", head: true }),
    supabase.from("transactions").select("id", { count: "exact", head: true }),
    supabase.from("items").select("id", { count: "exact", head: true }),
    supabase.from("branches").select("id", { count: "exact", head: true }),
  ]);
  console.log("Items:", items.count);
  console.log("Branches:", branches.count);
  console.log("Inventory rows:", inv.count);
  console.log("Transaction rows:", tx.count);
}

check();
