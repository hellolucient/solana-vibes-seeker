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
import { verifyXAuthToken } from "@/lib/x-auth-token";

export async function POST(req: NextRequest) {
  console.log("[vibe/claim/prepare] Request start");

  // Parse request body — support single vibeId or array vibeIds (for multi-claim)
  let body: {
    vibeId?: string;
    vibeIds?: string[];
    claimerWallet: string;
    xUsername?: string;
    x?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const claimerWallet = body.claimerWallet;
  const vibeIds: string[] = Array.isArray(body.vibeIds) && body.vibeIds.length > 0
    ? body.vibeIds
    : body.vibeId
      ? [body.vibeId]
      : [];

  // Get X username: body.xUsername (mobile) > body.x (web signed token) > cookie (web)
  let xUser: { id: string; username: string } | null = null;

  if (body.xUsername) {
    xUser = { id: "", username: body.xUsername };
  } else if (body.x) {
    const verified = verifyXAuthToken(body.x);
    if (verified) xUser = { id: "", username: verified.username };
  }
  if (!xUser) {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get(X_USER_COOKIE)?.value;
    if (userCookie) {
      try {
        const parsed = JSON.parse(userCookie);
        if (parsed.username) xUser = { id: parsed.id, username: parsed.username };
      } catch (e) {
        console.error("[vibe/claim/prepare] Invalid X user cookie:", e);
      }
    }
  }

  if (!xUser) {
    return NextResponse.json(
      { error: "Not authenticated with X. Please connect your X account first." },
      { status: 401 }
    );
  }
  if (!vibeIds.length || !claimerWallet) {
    return NextResponse.json(
      { error: "Missing vibeId/vibeIds or claimerWallet" },
      { status: 400 }
    );
  }

  const claimFeeLamports = getClaimFeeLamports();
  const claimFeeSol = Number(claimFeeLamports) / 1_000_000_000;
  const transactions: Array<{
    vibeId: string;
    transaction: string;
    blockhash: string;
    lastValidBlockHeight: number;
    mintAddress: string;
    feeLamports: string;
    feeSol: number;
  }> = [];

  try {
    for (const vibeId of vibeIds) {
      const vibe = await vibeStore.getById(vibeId);
      if (!vibe) {
        return NextResponse.json({ error: `Vibe not found: ${vibeId}` }, { status: 404 });
      }
      if (vibe.claimStatus === "claimed") {
        return NextResponse.json(
          { error: "One or more vibes have already been claimed" },
          { status: 400 }
        );
      }
      if (!vibe.mintAddress) {
        return NextResponse.json(
          { error: `Vibe ${vibeId} has not been minted yet` },
          { status: 400 }
        );
      }
      if (xUser.username.toLowerCase() !== vibe.targetUsername.toLowerCase()) {
        return NextResponse.json(
          {
            error: `This vibe is for @${vibe.targetUsername}, but you're logged in as @${xUser.username}`,
          },
          { status: 403 }
        );
      }
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
            error: "One or more vibes have already been claimed",
            claimStatus: "claimed",
            claimerWallet,
            claimedAt,
          },
          { status: 400 }
        );
      }

      const { serializedTransaction, blockhash, lastValidBlockHeight } = await buildClaimTransaction({
        mintAddress: vibe.mintAddress,
        claimerWallet,
      });

      transactions.push({
        vibeId,
        transaction: serializedTransaction,
        blockhash,
        lastValidBlockHeight,
        mintAddress: vibe.mintAddress,
        feeLamports: claimFeeLamports.toString(),
        feeSol: claimFeeSol,
      });
    }

    const first = transactions[0];
    console.log(
      `[vibe/claim/prepare] Built ${transactions.length} transaction(s), ~${claimFeeSol} SOL per NFT`
    );

    // Backward compat: top-level fields when single
    const payload: Record<string, unknown> = {
      transactions,
      feeSolPerNft: claimFeeSol,
    };
    if (transactions.length === 1) {
      payload.transaction = first.transaction;
      payload.blockhash = first.blockhash;
      payload.lastValidBlockHeight = first.lastValidBlockHeight;
      payload.vibeId = first.vibeId;
      payload.mintAddress = first.mintAddress;
      payload.feeLamports = first.feeLamports;
      payload.feeSol = first.feeSol;
    }

    return NextResponse.json(payload);
  } catch (e) {
    console.error("[vibe/claim/prepare] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to prepare claim" },
      { status: 500 }
    );
  }
}
