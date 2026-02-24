/**
 * Complete metadata and image for a vibe that was minted but had image/upload fail.
 * Used when confirm returned metadata_upload_failed so the client can retry.
 */

import { NextRequest, NextResponse } from "next/server";
import { vibeStore } from "@/lib/storage/supabase";
import { maskWallet } from "@/lib/wallet";
import { generateVibeImageBuffer } from "@/lib/image/generate-vibe-image";
import { uploadVibeAssets, createVibeMetadata } from "@/lib/storage/upload";
import { updateVibeMetadata } from "@/lib/solana/mint";

export async function POST(req: NextRequest) {
  let body: { vibeId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { vibeId } = body;
  if (!vibeId) {
    return NextResponse.json({ error: "Missing vibeId" }, { status: 400 });
  }

  const vibe = await vibeStore.getById(vibeId);
  if (!vibe) {
    return NextResponse.json({ error: "Vibe not found" }, { status: 404 });
  }

  if (!vibe.mintAddress) {
    return NextResponse.json(
      { error: "Vibe has no mint address; cannot complete metadata" },
      { status: 400 }
    );
  }

  if (vibe.metadataUri && vibe.imageUri) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    return NextResponse.json({
      success: true,
      vibeId,
      vibeUrl: `${baseUrl}/v/${vibeId}`,
      message: "Metadata already complete",
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const timestamp = vibe.createdAt ?? new Date().toISOString();
  const maskedWallet = maskWallet(vibe.senderWallet);
  const vibeIndexForRecipient = vibe.vibeIndexForRecipient ?? 1;

  try {
    const imageBuffer = await generateVibeImageBuffer({
      maskedWallet,
      recipientHandle: vibe.targetUsername,
      mintAddress: vibe.mintAddress,
      timestamp,
      vibeNumber: vibe.vibeNumber ?? 0,
      vibeIndexForRecipient,
    });

    const metadata = createVibeMetadata({
      vibeId,
      recipientHandle: vibe.targetUsername,
      senderWallet: vibe.senderWallet,
      maskedWallet,
      mintAddress: vibe.mintAddress,
      timestamp,
      baseUrl,
      vibeNumber: vibe.vibeNumber ?? 0,
      vibeIndexForRecipient,
    });

    const { imageUri, metadataUri } = await uploadVibeAssets({
      vibeId,
      imageBuffer,
      metadata,
      baseUrl,
    });

    try {
      await updateVibeMetadata(vibe.mintAddress, metadataUri);
    } catch (updateErr) {
      console.warn("[complete-metadata] Could not update NFT on-chain (non-fatal):", updateErr);
    }

    await vibeStore.update(vibeId, {
      metadataUri,
      imageUri,
    });

    const vibeUrl = `${baseUrl}/v/${vibeId}`;
    return NextResponse.json({
      success: true,
      vibeId,
      vibeUrl,
      mintAddress: vibe.mintAddress,
    });
  } catch (e) {
    console.error("[complete-metadata] Error:", e);
    return NextResponse.json(
      {
        error: "complete_metadata_failed",
        message: e instanceof Error ? e.message : "Failed to complete metadata",
      },
      { status: 500 }
    );
  }
}
