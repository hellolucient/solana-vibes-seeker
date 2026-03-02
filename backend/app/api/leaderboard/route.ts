/**
 * Leaderboard API: Vibers This Week (default), Claimed Vibes, and Most Vibed.
 * GET /api/leaderboard?view=week|claimed|most_vibed
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getLeaderboardWeekRows,
  getLeaderboardClaimedRows,
  getLeaderboardMostVibedRows,
} from "@/lib/storage/supabase";

function shortenWallet(wallet: string): string {
  if (wallet.length <= 10) return wallet;
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export async function GET(req: NextRequest) {
  const view = (req.nextUrl.searchParams.get("view") ?? "week") as
    | "week"
    | "claimed"
    | "most_vibed";

  if (view !== "week" && view !== "claimed" && view !== "most_vibed") {
    return NextResponse.json(
      { error: "Invalid view; use week, claimed, or most_vibed" },
      { status: 400 }
    );
  }

  if (view === "week") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await getLeaderboardWeekRows(sevenDaysAgo);

    type Agg = { count: number; claimedCount: number; latestCreatedAt: string; maskedWallet: string };
    const bySender = new Map<string, Agg>();

    for (const r of rows) {
      const existing = bySender.get(r.sender_wallet);
      const claimed = r.claim_status === "claimed" ? 1 : 0;
      if (!existing) {
        bySender.set(r.sender_wallet, {
          count: 1,
          claimedCount: claimed,
          latestCreatedAt: r.created_at,
          maskedWallet: r.masked_wallet || shortenWallet(r.sender_wallet),
        });
      } else {
        existing.count += 1;
        existing.claimedCount += claimed;
        if (r.created_at > existing.latestCreatedAt) {
          existing.latestCreatedAt = r.created_at;
        }
      }
    }

    const entries = Array.from(bySender.entries())
      .map(([wallet, agg]) => ({
        wallet,
        displayWallet: agg.maskedWallet,
        count: agg.count,
        claimedCount: agg.claimedCount,
        latestCreatedAt: agg.latestCreatedAt,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
      })
      .map(({ wallet, displayWallet, count, claimedCount }) => ({
        wallet,
        displayWallet,
        count,
        claimedCount,
      }));

    return NextResponse.json({ view: "week", entries });
  }

  if (view === "claimed") {
    const rows = await getLeaderboardClaimedRows();

    type ClaimedAgg = { count: number; latestClaimedAt: string; maskedWallet: string };
    const bySender = new Map<string, ClaimedAgg>();

    for (const r of rows) {
      const existing = bySender.get(r.sender_wallet);
      const claimedAt = r.claimed_at ?? "";
      if (!existing) {
        bySender.set(r.sender_wallet, {
          count: 1,
          latestClaimedAt: claimedAt,
          maskedWallet: r.masked_wallet || shortenWallet(r.sender_wallet),
        });
      } else {
        existing.count += 1;
        if (claimedAt > existing.latestClaimedAt) {
          existing.latestClaimedAt = claimedAt;
        }
      }
    }

    const entries = Array.from(bySender.entries())
      .map(([wallet, agg]) => ({
        wallet,
        displayWallet: agg.maskedWallet,
        count: agg.count,
        latestClaimedAt: agg.latestClaimedAt,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return (
          new Date(b.latestClaimedAt).getTime() -
          new Date(a.latestClaimedAt).getTime()
        );
      })
      .map(({ wallet, displayWallet, count }) => ({
        wallet,
        displayWallet,
        count,
      }));

    return NextResponse.json({ view: "claimed", entries });
  }

  // view === "most_vibed"
  const mostVibedRows = await getLeaderboardMostVibedRows();

  type MostVibedAgg = { count: number; claimedCount: number; latestCreatedAt: string };
  const byRecipient = new Map<string, MostVibedAgg>();

  for (const r of mostVibedRows) {
    const normalizedUsername = r.target_username.replace(/^@/, "").trim().toLowerCase();
    if (!normalizedUsername) continue;

    const existing = byRecipient.get(normalizedUsername);
    const claimed = r.claim_status === "claimed" ? 1 : 0;

    if (!existing) {
      byRecipient.set(normalizedUsername, {
        count: 1,
        claimedCount: claimed,
        latestCreatedAt: r.created_at,
      });
    } else {
      existing.count += 1;
      existing.claimedCount += claimed;
      if (r.created_at > existing.latestCreatedAt) {
        existing.latestCreatedAt = r.created_at;
      }
    }
  }

  const entries = Array.from(byRecipient.entries())
    .map(([username, agg]) => ({
      username,
      displayUsername: `@${username}`,
      count: agg.count,
      claimedCount: agg.claimedCount,
      latestCreatedAt: agg.latestCreatedAt,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
    })
    .map(({ username, displayUsername, count, claimedCount }) => ({
      username,
      displayUsername,
      count,
      claimedCount,
    }));

  return NextResponse.json({ view: "most_vibed", entries });
}
