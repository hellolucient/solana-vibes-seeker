/**
 * GET /api/vibe/pending/by-username?username=...
 *
 * Mobile-friendly version of /api/vibe/pending.
 * Accepts the X username as a query parameter instead of requiring auth cookies.
 * Used by the React Native app to check if the connected X user has a pending
 * or claimed vibe.
 *
 * Returns:
 *   { hasPending: true, vibeId, vibeUrl, senderWallet }
 *   { hasClaimed: true, vibeId, vibeUrl, mintAddress, solscanUrl }
 *   { hasPending: false, hasClaimed: false }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getPendingVibeByUsername,
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

  // Check for pending (unclaimed) vibe
  const pendingVibe = await getPendingVibeByUsername(username);
  if (pendingVibe) {
    return NextResponse.json({
      hasPending: true,
      hasClaimed: false,
      vibeId: pendingVibe.id,
      vibeUrl: `${baseUrl}/v/${pendingVibe.id}`,
      senderWallet:
        pendingVibe.maskedWallet ??
        pendingVibe.senderWallet.slice(0, 4) +
          "…" +
          pendingVibe.senderWallet.slice(-4),
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
