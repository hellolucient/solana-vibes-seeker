/**
 * Pull username check stats from the DB for sharing (e.g. in a post on X).
 *
 * Usage (from backend/):
 *   npx tsx scripts/username-check-stats.ts
 *
 * Requires: SUPABASE_URL and SUPABASE_ANON_KEY in .env
 * Requires: table username_check_counts (see docs/USERNAME_CHECK_COUNTS.md)
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Load .env from backend directory
function loadEnv() {
  const envPath = resolve(__dirname, "../.env");
  try {
    const content = readFileSync(envPath, "utf-8");
    content.split("\n").forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          const value = trimmed.slice(eq + 1).trim();
          if (key && !process.env[key]) process.env[key] = value;
        }
      }
    });
  } catch {
    console.error("Could not read backend/.env");
    process.exit(1);
  }
}

loadEnv();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("SUPABASE_URL and SUPABASE_ANON_KEY must be set in .env");
  process.exit(1);
}

const supabase: SupabaseClient = createClient(supabaseUrl, supabaseKey);

async function main() {
  // Total number of "username checks" (attempts to send a vibe to a @username)
  const { data: rows, error: selectError } = await supabase
    .from("username_check_counts")
    .select("username, check_count, updated_at");

  if (selectError) {
    console.error("Query failed:", selectError.message);
    console.error("Make sure the table username_check_counts exists (see docs/USERNAME_CHECK_COUNTS.md)");
    process.exit(1);
  }

  const totalChecks = (rows ?? []).reduce((sum, r) => sum + (r as { check_count: number }).check_count, 0);
  const uniqueUsernames = (rows ?? []).length;

  // Top checked usernames
  const sorted = [...(rows ?? [])].sort(
    (a, b) => (b as { check_count: number }).check_count - (a as { check_count: number }).check_count
  );
  const top5 = sorted.slice(0, 5) as { username: string; check_count: number; updated_at: string }[];

  console.log("\n--- solana_vibes · username check stats ---\n");
  console.log(`Total checks (attempts to send a vibe to a @username): ${totalChecks.toLocaleString()}`);
  console.log(`Unique @usernames checked: ${uniqueUsernames.toLocaleString()}`);
  if (top5.length > 0) {
    console.log("\nTop 5 most checked @usernames:");
    top5.forEach((r, i) => console.log(`  ${i + 1}. @${r.username} — ${r.check_count} check${r.check_count === 1 ? "" : "s"}`));
  }
  console.log("\n--- copy above for your post ---\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
