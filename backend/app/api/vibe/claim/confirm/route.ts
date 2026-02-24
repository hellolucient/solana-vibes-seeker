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

  // Parse request body — single or multiple (signedTransactions array)
  let body: {
    vibeId?: string;
    claimerWallet: string;
    signedTransaction?: string;
    blockhash?: string;
    lastValidBlockHeight?: number;
    signedTransactions?: Array<{
      vibeId: string;
      signedTransaction: string;
      blockhash: string;
      lastValidBlockHeight: number;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { claimerWallet } = body;
  const items: Array<{ vibeId: string; signedTransaction: string; blockhash: string; lastValidBlockHeight: number }> =
    Array.isArray(body.signedTransactions) && body.signedTransactions.length > 0
      ? body.signedTransactions
      : body.vibeId && body.signedTransaction && body.blockhash != null && body.lastValidBlockHeight != null
        ? [
            {
              vibeId: body.vibeId,
              signedTransaction: body.signedTransaction,
              blockhash: body.blockhash,
              lastValidBlockHeight: body.lastValidBlockHeight,
            },
          ]
        : [];

  if (!items.length || !claimerWallet) {
    return NextResponse.json(
      { error: "Missing vibeId/signedTransaction or signedTransactions array, or claimerWallet" },
      { status: 400 }
    );
  }

  try {
    const connection = new Connection(getRpcUrl(), "confirmed");
    const results: Array<{ vibeId: string; mintAddress: string; signature: string }> = [];

    for (const item of items) {
      const { vibeId, signedTransaction, blockhash, lastValidBlockHeight } = item;

      const vibe = await vibeStore.getById(vibeId);
      if (!vibe) {
        return NextResponse.json({ error: `Vibe not found: ${vibeId}` }, { status: 404 });
      }
      if (!vibe.mintAddress) {
        return NextResponse.json(
          { error: `Vibe ${vibeId} has no mint address` },
          { status: 400 }
        );
      }

      const transactionBuffer = Buffer.from(signedTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      console.log(`[vibe/claim/confirm] Sending transaction to RPC...`);
      const signature = await connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        maxRetries: 3,
      });
      console.log(`[vibe/claim/confirm] Transaction sent: ${signature}`);

      const maxRetries = 30;
      const retryDelay = 1000;

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

        const blockHeight = await connection.getBlockHeight();
        if (blockHeight > lastValidBlockHeight) {
          console.error(`[vibe/claim/confirm] Blockhash expired`);
          return NextResponse.json(
            { error: "Transaction expired - please try again" },
            { status: 500 }
          );
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
      }

      await vibeStore.update(vibeId, {
        claimStatus: "claimed",
        claimerWallet,
        claimedAt: new Date().toISOString(),
      });

      results.push({ vibeId, mintAddress: vibe.mintAddress, signature });
    }

    console.log(
      `[vibe/claim/confirm] Claim confirmed for @${xUsername}, ${results.length} vibe(s)`
    );

    const first = results[0];
    const payload: Record<string, unknown> = {
      success: true,
      results,
    };
    if (results.length === 1) {
      payload.vibeId = first.vibeId;
      payload.mintAddress = first.mintAddress;
      payload.claimerWallet = claimerWallet;
      payload.signature = first.signature;
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[vibe/claim/confirm] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to confirm claim" },
      { status: 500 }
    );
  }
}
