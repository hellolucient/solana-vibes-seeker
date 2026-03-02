import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/storage/supabase";

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;

  const expected = `Bearer ${cronSecret}`;
  return authHeader === expected;
}

/**
 * Daily keepalive endpoint for Supabase.
 * Triggered by Vercel Cron to run a minimal read query.
 */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();

  const { data, error } = await supabase
    .from("vibes")
    .select("id")
    .limit(1);

  if (error) {
    console.error("[supabase-keepalive] Query failed:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    touched: true,
    rowsSeen: data?.length ?? 0,
    elapsedMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  });
}
