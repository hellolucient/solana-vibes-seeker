/**
 * Prepare a claim transaction for the user to sign.
 * 
 * Returns a partially-signed transaction that:
 * 1. Transfers the NFT from vault to claimer
 * 2. Updates the on-chain status attribute to "claimed"
 * 3. Transfers micro-fee to treasury
 * 
 * The claimer signs as fee payer and submits.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { vibeStore } from "@/lib/storage/supabase";
import { isVibeInVault } from "@/lib/solana/mint";
import { buildClaimTransaction } from "@/lib/solana/claim-transaction";
import { getClaimFeeLamports } from "@/lib/solana/config";
import { X_USER_COOKIE } from "@/lib/x-oauth-1";

export async function POST(req: NextRequest) {
  console.log("[vibe/claim/prepare] Request start");

  // Get the X user from cookie
  const cookieStore = await cookies();
  const userCookie = cookieStore.get(X_USER_COOKIE)?.value;

  if (!userCookie) {
    return NextResponse.json(
      { error: "Not authenticated with X. Please connect your X account first." },
      { status: 401 }
    );
  }

  // Parse the user info from cookie
  let xUser: { id: string; username: string };
  try {
    const parsed = JSON.parse(userCookie);
    if (!parsed.username) {
      throw new Error("No username in cookie");
    }
    xUser = { id: parsed.id, username: parsed.username };
  } catch (e) {
    console.error("[vibe/claim/prepare] Invalid X user cookie:", e);
    return NextResponse.json(
      { error: "X authentication failed. Please reconnect your X account." },
      { status: 401 }
    );
  }

  // Parse request body
  let body: { vibeId: string; claimerWallet: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { vibeId, claimerWallet } = body;
  if (!vibeId || !claimerWallet) {
    return NextResponse.json(
      { error: "Missing vibeId or claimerWallet" },
      { status: 400 }
    );
  }

  try {
    // Get the vibe record
    const vibe = await vibeStore.getById(vibeId);
    if (!vibe) {
      return NextResponse.json({ error: "Vibe not found" }, { status: 404 });
    }

    // Check if already claimed
    if (vibe.claimStatus === "claimed") {
      return NextResponse.json(
        { error: "This vibe has already been claimed" },
        { status: 400 }
      );
    }

    // Check if mint address exists
    if (!vibe.mintAddress) {
      return NextResponse.json(
        { error: "Vibe has not been minted yet" },
        { status: 400 }
      );
    }

    // Verify that the X user matches the target
    if (xUser.username.toLowerCase() !== vibe.targetUsername.toLowerCase()) {
      console.log(
        `[vibe/claim/prepare] Username mismatch: ${xUser.username} !== ${vibe.targetUsername}`
      );
      return NextResponse.json(
        {
          error: `This vibe is for @${vibe.targetUsername}, but you're logged in as @${xUser.username}`,
        },
        { status: 403 }
      );
    }

    // Verify the NFT is still in the vault
    const inVault = await isVibeInVault(vibe.mintAddress);
    if (!inVault) {
      const claimedAt = new Date().toISOString();
      await vibeStore.update(vibeId, {
        claimStatus: "claimed",
        claimerWallet,
        claimedAt,
      });
      return NextResponse.json(
        {
          error: "This vibe has already been claimed",
          claimStatus: "claimed",
          claimerWallet,
          claimedAt,
        },
        { status: 400 }
      );
    }

    // Build the claim transaction (transfer + update status)
    console.log(
      `[vibe/claim/prepare] Building transaction for ${vibe.mintAddress} -> ${claimerWallet}`
    );
    
    const { serializedTransaction, blockhash, lastValidBlockHeight } = await buildClaimTransaction({
      mintAddress: vibe.mintAddress,
      claimerWallet,
    });

    // Get fee info for display
    const claimFeeLamports = getClaimFeeLamports();
    const claimFeeSol = Number(claimFeeLamports) / 1_000_000_000;

    console.log(`[vibe/claim/prepare] Transaction built with ${claimFeeSol} SOL fee, returning to client`);

    return NextResponse.json({
      transaction: serializedTransaction,
      blockhash,
      lastValidBlockHeight,
      vibeId,
      mintAddress: vibe.mintAddress,
      // Fee info for frontend display
      feeLamports: claimFeeLamports.toString(),
      feeSol: claimFeeSol,
    });
  } catch (e) {
    console.error("[vibe/claim/prepare] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to prepare claim" },
      { status: 500 }
    );
  }
}
