/**
 * Claim a vibe: transfer NFT from vault to claimer's wallet.
 * 
 * Requirements:
 * 1. Caller must be authenticated with X (OAuth 1.0a)
 * 2. X username must match the vibe's target username
 * 3. Vibe must not already be claimed
 * 4. Vibe must have a mint address
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { vibeStore } from "@/lib/storage/supabase";
import { transferVibeToClaimer, isVibeInVault } from "@/lib/solana/mint";
import { X_USER_COOKIE } from "@/lib/x-oauth-1";

export async function POST(req: NextRequest) {
  const start = Date.now();
  console.log("[vibe/claim] Request start");

  // Get the X user from cookie (OAuth 1.0a stores user info directly)
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
    console.error("[vibe/claim] Invalid X user cookie:", e);
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
        `[vibe/claim] Username mismatch: ${xUser.username} !== ${vibe.targetUsername}`
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
      // NFT was already transferred (e.g. double-claim or claim/confirm succeeded elsewhere)
      await vibeStore.update(vibeId, {
        claimStatus: "claimed",
        claimerWallet,
        claimedAt: new Date().toISOString(),
      });
      return NextResponse.json(
        { error: "This vibe has already been claimed" },
        { status: 400 }
      );
    }

    // Transfer the NFT to the claimer
    console.log(
      `[vibe/claim] Transferring ${vibe.mintAddress} to ${claimerWallet} for @${xUser.username}`
    );
    const signature = await transferVibeToClaimer(vibe.mintAddress, claimerWallet);

    // Update the vibe record
    await vibeStore.update(vibeId, {
      claimStatus: "claimed",
      claimerWallet,
      claimedAt: new Date().toISOString(),
    });

    console.log(`[vibe/claim] Complete in ${Date.now() - start}ms, sig: ${signature}`);

    return NextResponse.json({
      success: true,
      vibeId,
      mintAddress: vibe.mintAddress,
      claimerWallet,
      signature,
    });
  } catch (e) {
    console.error("[vibe/claim] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to claim vibe" },
      { status: 500 }
    );
  }
}
