/**
 * GET: Check if the current X user has a vibe (pending to claim, or already claimed).
 * Requires X auth cookie.
 * Returns { hasPending, ... } | { hasClaimed, vibeId, vibeUrl, mintAddress, solscanUrl } | { hasPending: false, hasClaimed: false }.
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getPendingVibeByUsername, getClaimedVibeByUsername } from "@/lib/storage/supabase";
import { X_USER_COOKIE } from "@/lib/x-oauth-1";

function getSolscanTokenUrl(mintAddress: string, cluster?: "mainnet" | "devnet"): string {
  const base = `https://solscan.io/token/${mintAddress}`;
  return cluster === "devnet" ? `${base}?cluster=devnet` : base;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const userCookie = cookieStore.get(X_USER_COOKIE)?.value;

  if (!userCookie) {
    return NextResponse.json(
      { hasPending: false, hasClaimed: false, error: "Not authenticated with X" },
      { status: 200 }
    );
  }

  let username: string;
  try {
    const parsed = JSON.parse(userCookie);
    if (!parsed.username) throw new Error("No username");
    username = parsed.username;
  } catch {
    return NextResponse.json(
      { hasPending: false, hasClaimed: false, error: "Invalid X session" },
      { status: 200 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const rpc = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "";
  const cluster = rpc.toLowerCase().includes("mainnet") ? "mainnet" : "devnet";

  const pendingVibe = await getPendingVibeByUsername(username);
  if (pendingVibe) {
    return NextResponse.json({
      hasPending: true,
      hasClaimed: false,
      vibeId: pendingVibe.id,
      vibeUrl: `${baseUrl}/v/${pendingVibe.id}`,
      senderWallet: pendingVibe.maskedWallet ?? pendingVibe.senderWallet.slice(0, 4) + "…" + pendingVibe.senderWallet.slice(-4),
    });
  }

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
