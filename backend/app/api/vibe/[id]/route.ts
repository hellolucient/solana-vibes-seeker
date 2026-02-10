/**
 * Get vibe by ID (debug / internal).
 */

import { NextRequest, NextResponse } from "next/server";
import { vibeStore } from "@/lib/storage/supabase";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const vibe = await vibeStore.getById(id);
  if (!vibe) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(vibe);
}
