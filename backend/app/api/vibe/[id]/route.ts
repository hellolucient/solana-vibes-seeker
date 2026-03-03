/**
 * Get vibe by ID (debug / internal).
 * Cache-Control: no-store so clients always get fresh claim status after claiming.
 */

import { NextRequest, NextResponse } from "next/server";
import { vibeStore } from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vibe = await vibeStore.getById(id);
  if (!vibe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  };
  return NextResponse.json(vibe, { headers });
}
