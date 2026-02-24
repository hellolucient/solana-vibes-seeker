/**
 * GET /api/vibe/pending/by-username?username=...
 *
 * Mobile-friendly version of /api/vibe/pending.
 * Accepts the X username as a query parameter instead of requiring auth cookies.
 * Used by the React Native app to check if the connected X user has pending
 * or claimed vibes.
 *
 * Returns:
 *   { hasPending: true, pendingCount: N, pendingVibes: [...], vibeId, vibeUrl, senderWallet }  (vibeId/vibeUrl/senderWallet = first pending for backward compat)
 *   { hasClaimed: true, ... }
 *   { hasPending: false, hasClaimed: false }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getPendingVibesByUsername,
  getClaimedVibeByUsername,
} from "@/lib/storage/supabase";

function getSolscanTokenUrl(
  mintAddress: string,
  cluster?: "mainnet" | "devnet"
): string {
  const base = `https://solscan.io/token/${mintAddress}`;
  return cluster === "devnet" ? `${base}?cluster=devnet` : base;
}

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");

  if (!username || username.trim().length === 0) {
    return NextResponse.json(
      { hasPending: false, hasClaimed: false, error: "Missing username param" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "";
  const cluster = rpc.toLowerCase().includes("mainnet") ? "mainnet" : "devnet";

  // Check for pending (unclaimed) vibes — list all, oldest first
  const pendingList = await getPendingVibesByUsername(username);
  if (pendingList.length > 0) {
    const first = pendingList[0];
    return NextResponse.json({
      hasPending: true,
      pendingCount: pendingList.length,
      pendingVibes: pendingList.map((v) => ({
        id: v.id,
        createdAt: v.createdAt,
        maskedWallet: v.maskedWallet,
        vibeIndexForRecipient: v.vibeIndexForRecipient,
      })),
      // Backward compat: first pending
      vibeId: first.id,
      vibeUrl: `${baseUrl}/v/${first.id}`,
      senderWallet:
        first.maskedWallet ??
        first.senderWallet.slice(0, 4) + "…" + first.senderWallet.slice(-4),
    });
  }

  // Check for already-claimed vibe
  const claimedVibe = await getClaimedVibeByUsername(username);
  if (claimedVibe?.mintAddress) {
    return NextResponse.json({
      hasPending: false,
      hasClaimed: true,
      vibeId: claimedVibe.id,
      vibeUrl: `${baseUrl}/v/${claimedVibe.id}`,
      mintAddress: claimedVibe.mintAddress,
      solscanUrl: getSolscanTokenUrl(claimedVibe.mintAddress, cluster),
    });
  }

  return NextResponse.json({ hasPending: false, hasClaimed: false });
}
