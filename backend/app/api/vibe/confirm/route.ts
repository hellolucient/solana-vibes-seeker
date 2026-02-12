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

// Allow up to 90s for confirmation polling (Vercel default can be 15s)
export const maxDuration = 90;
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { vibeStore } from "@/lib/storage/supabase";
import { maskWallet } from "@/lib/wallet";
import { generateVibeImageBuffer } from "@/lib/image/generate-vibe-image";
import { uploadVibeAssets, createVibeMetadata } from "@/lib/storage/upload";
import { updateVibeMetadata } from "@/lib/solana/mint";
import { getRpcUrl, isMainnet } from "@/lib/solana/config";

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

    // Verify transaction has signatures
    const signatures = transaction.signatures;
    console.log(`[vibe/confirm] Transaction has ${signatures.length} signatures`);
    if (signatures.length === 0) {
      await vibeStore.delete(vibeId);
      return NextResponse.json(
        { error: "Transaction has no signatures" },
        { status: 400 }
      );
    }

    // Log signature details for debugging
    signatures.forEach((sig, idx) => {
      const sigStr = Buffer.from(sig).toString('base64');
      const isEmpty = sig.every(b => b === 0);
      console.log(`[vibe/confirm] Signature ${idx}: ${sigStr.slice(0, 16)}... (empty: ${isEmpty})`);
    });

    console.log("[vibe/confirm] Submitting transaction...");

    // skipPreflight: false — use preflight simulation like the working web app
    // If simulation fails with "signature verification", it might be a false positive
    // but we should still try to send it
    let signature: string;
    try {
      signature = await connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: false, maxRetries: 3 }
      );
      console.log(`[vibe/confirm] Transaction sent: ${signature}`);
    } catch (sendErr) {
      console.error("[vibe/confirm] Failed to send transaction:", sendErr);
      await vibeStore.delete(vibeId);
      return NextResponse.json(
        { 
          error: `Failed to send transaction: ${sendErr instanceof Error ? sendErr.message : 'Unknown error'}`,
        },
        { status: 500 }
      );
    }

    // Step 3: Wait for confirmation using polling (WebSocket doesn't work on Vercel)
    let confirmed = false;
    let finalStatus: any = null;
    const maxAttempts = 90; // 90s total (Vercel maxDuration allows this)
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const status = await connection.getSignatureStatus(signature, {
          searchTransactionHistory: true, // Find tx even if RPC was slow to index
        });
        
        finalStatus = status.value;
        
        if (status.value?.confirmationStatus === "confirmed" || 
            status.value?.confirmationStatus === "finalized") {
          if (status.value.err) {
            console.error("[vibe/confirm] Transaction failed:", status.value.err);
            await vibeStore.delete(vibeId);
            return NextResponse.json(
              { 
                error: "Transaction failed on-chain",
                signature,
                err: status.value.err,
              },
              { status: 500 }
            );
          }
          confirmed = true;
          break;
        }
        
        // Transaction explicitly failed (e.g. blockhash expired)
        if (status.value?.err) {
          console.error("[vibe/confirm] Transaction failed:", status.value.err);
          await vibeStore.delete(vibeId);
          return NextResponse.json(
            { 
              error: "Transaction failed on-chain",
              signature,
              err: status.value.err,
            },
            { status: 500 }
          );
        }
      } catch (statusErr) {
        console.warn(`[vibe/confirm] Error checking status (attempt ${attempt + 1}):`, statusErr);
        // Continue polling even if one status check fails
      }
      
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    
    if (!confirmed) {
      // Before deleting, do a final check - transaction might have succeeded
      // but RPC was slow to report it
      try {
        const finalCheck = await connection.getSignatureStatus(signature, {
          searchTransactionHistory: true,
        });
        if (finalCheck.value && 
            (finalCheck.value.confirmationStatus === "confirmed" || 
             finalCheck.value.confirmationStatus === "finalized") &&
            !finalCheck.value.err) {
          console.log("[vibe/confirm] Transaction confirmed on final check");
          confirmed = true;
        }
      } catch (finalErr) {
        console.warn("[vibe/confirm] Final status check failed:", finalErr);
      }
      
      if (!confirmed) {
        const solscanBase = isMainnet() ? "https://solscan.io/tx" : "https://solscan.io/tx?cluster=devnet";
        // Don't delete the vibe - user can check the transaction manually
        // It might have succeeded but RPC was slow
        console.warn(`[vibe/confirm] Confirmation timeout after ${maxAttempts}s. Signature: ${signature}`);
        return NextResponse.json(
          {
            error: `Transaction confirmation timeout after ${maxAttempts}s. The transaction may still be processing. Check status: ${solscanBase}/${signature}`,
            signature,
            status: finalStatus,
          },
          { status: 504 }
        );
      }
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
