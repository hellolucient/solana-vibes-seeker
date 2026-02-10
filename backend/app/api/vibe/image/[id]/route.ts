/**
 * Serve vibe image. On Vercel reads from /tmp/vibes (ephemeral); locally from public/media/vibes.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!id || !/^[a-z0-9]+$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  const imagePath =
    process.env.VERCEL === "1"
      ? path.join("/tmp", "vibes", `${id}.png`)
      : path.join(process.cwd(), "public", "media", "vibes", `${id}.png`);

  try {
    const buf = await readFile(imagePath);
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
