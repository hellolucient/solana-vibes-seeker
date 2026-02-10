/**
 * Confirm a claim: receive signed transaction from client, send to RPC, update database.
 * 
 * The backend handles sending to RPC to avoid client-side RPC issues on mobile.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { vibeStore } from "@/lib/storage/supabase";
import { X_USER_COOKIE } from "@/lib/x-oauth-1";
import { getRpcUrl } from "@/lib/solana/config";

export async function POST(req: NextRequest) {
  console.log("[vibe/claim/confirm] Request start");

  // Get the X user from cookie (for logging)
  const cookieStore = await cookies();
  const userCookie = cookieStore.get(X_USER_COOKIE)?.value;
  let xUsername = "unknown";
  if (userCookie) {
    try {
      const parsed = JSON.parse(userCookie);
      xUsername = parsed.username || "unknown";
    } catch {
      // ignore
    }
  }

  // Parse request body
  let body: { 
    vibeId: string; 
    claimerWallet: string; 
    signedTransaction: string;
    blockhash: string;
    lastValidBlockHeight: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { vibeId, claimerWallet, signedTransaction, blockhash, lastValidBlockHeight } = body;
  if (!vibeId || !claimerWallet || !signedTransaction) {
    return NextResponse.json(
      { error: "Missing vibeId, claimerWallet, or signedTransaction" },
      { status: 400 }
    );
  }

  try {
    // Get the vibe record
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

    // Deserialize the signed transaction
    const transactionBuffer = Buffer.from(signedTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(transactionBuffer);

    // Send to RPC from backend (avoids mobile client RPC issues)
    const connection = new Connection(getRpcUrl(), "confirmed");
    
    console.log(`[vibe/claim/confirm] Sending transaction to RPC...`);
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: false,
      maxRetries: 3,
    });
    console.log(`[vibe/claim/confirm] Transaction sent: ${signature}`);

    // Wait for confirmation using polling (WebSocket doesn't work in serverless)
    console.log(`[vibe/claim/confirm] Waiting for confirmation (polling)...`);
    const maxRetries = 30;
    const retryDelay = 1000; // 1 second
    
    for (let i = 0; i < maxRetries; i++) {
      const statuses = await connection.getSignatureStatuses([signature]);
      const status = statuses.value[0];
      
      if (status) {
        if (status.err) {
          console.error(`[vibe/claim/confirm] Transaction failed:`, status.err);
          return NextResponse.json(
            { error: "Transaction failed on-chain" },
            { status: 500 }
          );
        }
        
        if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
          console.log(`[vibe/claim/confirm] Transaction confirmed: ${signature}`);
          break;
        }
      }
      
      // Check if blockhash expired
      const blockHeight = await connection.getBlockHeight();
      if (blockHeight > lastValidBlockHeight) {
        console.error(`[vibe/claim/confirm] Blockhash expired`);
        return NextResponse.json(
          { error: "Transaction expired - please try again" },
          { status: 500 }
        );
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
    
    console.log(`[vibe/claim/confirm] Transaction confirmed: ${signature}`);

    // Update the database
    await vibeStore.update(vibeId, {
      claimStatus: "claimed",
      claimerWallet,
      claimedAt: new Date().toISOString(),
    });

    console.log(
      `[vibe/claim/confirm] Claim confirmed for @${xUsername}, vibe ${vibeId}, sig: ${signature}`
    );

    return NextResponse.json({
      success: true,
      vibeId,
      mintAddress: vibe.mintAddress,
      claimerWallet,
      signature,
    });
  } catch (e) {
    console.error("[vibe/claim/confirm] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to confirm claim" },
      { status: 500 }
    );
  }
}
