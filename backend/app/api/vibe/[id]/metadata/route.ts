/**
 * Serve vibe metadata JSON.
 * 
 * On Vercel: Fetches from Vercel Blob storage
 * Locally: Reads from filesystem
 * 
 * This route exists as a fallback when the on-chain metadata URI
 * update fails (e.g., due to RPC lag). The NFT is minted with this
 * route as the initial URI, then updated to point directly to Blob.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { list } from "@vercel/blob";
import path from "path";

// Check if we should use Vercel Blob
const USE_BLOB = !!process.env.BLOB_READ_WRITE_TOKEN;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate ID format (basic alphanumeric check)
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    let metadata;

    if (USE_BLOB) {
      // Fetch from Vercel Blob
      const { blobs } = await list({ prefix: `metadata/${id}.json` });
      
      if (blobs.length === 0) {
        console.error(`[metadata] Not found in Blob: ${id}`);
        return NextResponse.json({ error: "Metadata not found" }, { status: 404 });
      }

      const response = await fetch(blobs[0].url);
      if (!response.ok) {
        throw new Error(`Failed to fetch from Blob: ${response.status}`);
      }
      metadata = await response.json();
    } else {
      // Read from local filesystem (dev mode)
      const metadataPath = path.join(
        process.cwd(),
        "public",
        "media",
        "metadata",
        `${id}.json`
      );
      const content = await readFile(metadataPath, "utf-8");
      metadata = JSON.parse(content);
    }

    return NextResponse.json(metadata, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    console.error(`[metadata] Not found: ${id}`, e);
    return NextResponse.json({ error: "Metadata not found" }, { status: 404 });
  }
}
