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
  getClaimedVibesByUsername,
} from "@/lib/storage/supabase";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

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
      { status: 400, headers: NO_CACHE_HEADERS }
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
        imageUrl: v.imageUri ?? undefined,
      })),
      // Backward compat: first pending
      vibeId: first.id,
      vibeUrl: `${baseUrl}/v/${first.id}`,
      senderWallet:
        first.maskedWallet ??
        first.senderWallet.slice(0, 4) + "…" + first.senderWallet.slice(-4),
    }, { headers: NO_CACHE_HEADERS });
  }

  // Check for already-claimed vibe(s)
  const claimedList = await getClaimedVibesByUsername(username);
  if (claimedList.length > 0) {
    const first = claimedList[0];
    return NextResponse.json({
      hasPending: false,
      hasClaimed: true,
      claimedCount: claimedList.length,
      claimedVibes: claimedList.map((v) => ({
        id: v.id,
        vibeUrl: `${baseUrl}/v/${v.id}`,
        imageUrl: v.imageUri,
        mintAddress: v.mintAddress,
        solscanUrl: v.mintAddress ? getSolscanTokenUrl(v.mintAddress, cluster) : undefined,
        createdAt: v.createdAt,
        claimedAt: v.claimedAt,
        maskedWallet: v.maskedWallet,
      })),
      // Backward compat: first claimed
      vibeId: first.id,
      vibeUrl: `${baseUrl}/v/${first.id}`,
      mintAddress: first.mintAddress,
      solscanUrl: first.mintAddress ? getSolscanTokenUrl(first.mintAddress, cluster) : undefined,
    }, { headers: NO_CACHE_HEADERS });
  }

  return NextResponse.json({ hasPending: false, hasClaimed: false }, { headers: NO_CACHE_HEADERS });
}
