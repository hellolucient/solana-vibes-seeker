/**
 * Confirm a vibe mint after the sender has signed the transaction.
 * 
 * Flow:
 * 1. Receive the signed transaction from frontend
 * 2. Submit to blockchain and wait for confirmation
 * 3. Generate the final image with mint address
 * 4. Upload image and metadata
 * 5. Update NFT metadata on-chain
 * 6. Return vibe URL for tweeting
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { vibeStore } from "@/lib/storage/supabase";
import { maskWallet } from "@/lib/wallet";
import { generateVibeImageBuffer } from "@/lib/image/generate-vibe-image";
import { uploadVibeAssets, createVibeMetadata } from "@/lib/storage/upload";
import { updateVibeMetadata } from "@/lib/solana/mint";
import { getRpcUrl } from "@/lib/solana/config";

export async function POST(req: NextRequest) {
  const start = Date.now();
  console.log("[vibe/confirm] Request start");

  let body: {
    vibeId: string;
    signedTransaction: string; // base64 encoded
    blockhash: string;
    lastValidBlockHeight: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { vibeId, signedTransaction, blockhash, lastValidBlockHeight } = body;

  if (!vibeId || !signedTransaction || !blockhash || !lastValidBlockHeight) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Get the vibe record
    const vibe = await vibeStore.getById(vibeId);
    if (!vibe) {
      return NextResponse.json({ error: "Vibe not found" }, { status: 404 });
    }

    if (!vibe.mintAddress) {
      return NextResponse.json(
        { error: "Vibe has no mint address" },
        { status: 400 }
      );
    }

    console.log(`[vibe/confirm] Processing vibe ${vibeId}, mint: ${vibe.mintAddress}`);

    // Step 2: Deserialize and submit the transaction
    const connection = new Connection(getRpcUrl(), "confirmed");
    const transactionBuffer = Buffer.from(signedTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    console.log("[vibe/confirm] Submitting transaction...");

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      { skipPreflight: false }
    );

    console.log(`[vibe/confirm] Transaction sent: ${signature}`);

    // Step 3: Wait for confirmation using polling (WebSocket doesn't work on Vercel)
    let confirmed = false;
    const maxAttempts = 30;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const status = await connection.getSignatureStatus(signature);
      
      if (status.value?.confirmationStatus === "confirmed" || 
          status.value?.confirmationStatus === "finalized") {
        if (status.value.err) {
          console.error("[vibe/confirm] Transaction failed:", status.value.err);
          // Clean up the failed vibe record
          await vibeStore.delete(vibeId);
          return NextResponse.json(
            { error: "Transaction failed on-chain" },
            { status: 500 }
          );
        }
        confirmed = true;
        break;
      }
      
      // Wait 1 second before next poll
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    if (!confirmed) {
      // Clean up on timeout - transaction may have failed
      await vibeStore.delete(vibeId);
      return NextResponse.json(
        { error: "Transaction confirmation timeout" },
        { status: 500 }
      );
    }

    console.log(`[vibe/confirm] Transaction confirmed: ${signature}`);

    // Step 4: Generate final image
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
    const timestamp = new Date().toISOString();
    const maskedWallet = maskWallet(vibe.senderWallet);

    const imageBuffer = await generateVibeImageBuffer({
      maskedWallet,
      recipientHandle: vibe.targetUsername,
      mintAddress: vibe.mintAddress,
      timestamp,
      vibeNumber: vibe.vibeNumber,
    });

    console.log("[vibe/confirm] Image generated");

    // Step 5: Create and upload metadata
    const metadata = createVibeMetadata({
      vibeId,
      recipientHandle: vibe.targetUsername,
      senderWallet: vibe.senderWallet,
      maskedWallet,
      mintAddress: vibe.mintAddress,
      timestamp,
      baseUrl,
      vibeNumber: vibe.vibeNumber,
    });

    const { imageUri, metadataUri } = await uploadVibeAssets({
      vibeId,
      imageBuffer,
      metadata,
      baseUrl,
    });

    console.log(`[vibe/confirm] Assets uploaded: ${imageUri}`);

    // Step 6: Update NFT metadata on-chain (optional - may fail due to RPC lag)
    try {
      await updateVibeMetadata(vibe.mintAddress, metadataUri);
      console.log("[vibe/confirm] NFT metadata updated on-chain");
    } catch (updateErr) {
      // Non-fatal: the placeholder URI still works
      console.warn("[vibe/confirm] Could not update NFT metadata (non-fatal):", updateErr);
    }

    // Step 7: Update vibe record
    await vibeStore.update(vibeId, {
      metadataUri,
      imageUri,
    });

    const vibeUrl = `${baseUrl}/v/${vibeId}`;

    console.log(`[vibe/confirm] Complete in ${Date.now() - start}ms`);

    return NextResponse.json({
      success: true,
      vibeId,
      vibeUrl,
      mintAddress: vibe.mintAddress,
      signature,
    });
  } catch (e) {
    console.error("[vibe/confirm] Error:", e);
    // Clean up the failed vibe record
    try {
      await vibeStore.delete(body.vibeId);
    } catch (deleteErr) {
      console.error("[vibe/confirm] Failed to cleanup:", deleteErr);
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to confirm vibe" },
      { status: 500 }
    );
  }
}
