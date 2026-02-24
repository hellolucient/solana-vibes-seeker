/**
 * Prepare a vibe mint transaction for the sender to sign.
 * 
 * Sender-pays flow:
 * 1. Create a pending vibe record
 * 2. Build a transaction where sender pays for mint + micro-fee
 * 3. Authority partially signs for NFT creation
 * 4. Return transaction for sender to sign
 * 
 * After signing, frontend submits to /api/vibe/confirm
 */

import { NextRequest, NextResponse } from "next/server";
import { vibeStore, getVibeBySenderAndUsername, recordUsernameCheck } from "@/lib/storage/supabase";
import { maskWallet } from "@/lib/wallet";
import { generateVibeId } from "@/lib/id";
import { buildMintTransaction } from "@/lib/solana/mint-transaction";

export async function POST(req: NextRequest) {
  const start = Date.now();
  console.log("[vibe/prepare] Request start");

  let body: { targetUsername: string; senderWallet: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { targetUsername, senderWallet } = body;
  if (!targetUsername || typeof senderWallet !== "string") {
    return NextResponse.json(
      { error: "Missing targetUsername or senderWallet" },
      { status: 400 }
    );
  }

  const username = targetUsername.replace(/^@/, "").trim();
  if (!username) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  // Track that this @username was checked (attempt to send a vibe to it)
  recordUsernameCheck(username).catch(() => {});

  const vibeId = generateVibeId();
  const maskedWallet = maskWallet(senderWallet);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  // Placeholder URI (will be updated after image generation in confirm step)
  const placeholderUri = `${baseUrl}/api/vibe/${vibeId}/metadata`;

  try {
    // Check if this sender has already sent a vibe to this username (one per wallet per @username)
    const existingVibe = await getVibeBySenderAndUsername(senderWallet, username);
    if (existingVibe) {
      // If it's a pending vibe, check if it was successfully minted
      if (existingVibe.claimStatus === "pending") {
        // If it has metadataUri or imageUri, it was successfully minted - don't allow another
        if (existingVibe.metadataUri || existingVibe.imageUri) {
          console.log(`[vibe/prepare] Sender already has a minted vibe to @${username}`);
          return NextResponse.json(
            {
              error: "already_vibed",
              message: `You have already sent a vibe to @${username}`,
              senderWallet: existingVibe.maskedWallet,
            },
            { status: 409 }
          );
        }

        // If it's older than 10 minutes and has no metadata/image, it's an incomplete mint
        const createdAt = new Date(existingVibe.createdAt);
        const ageMinutes = (Date.now() - createdAt.getTime()) / (1000 * 60);

        if (ageMinutes > 10) {
          console.log(`[vibe/prepare] Cleaning up stale incomplete mint to @${username} (${ageMinutes.toFixed(1)} minutes old)`);
          await vibeStore.delete(existingVibe.id);
          // Continue to create new vibe
        } else {
          console.log(`[vibe/prepare] Sender already has pending mint to @${username} (${ageMinutes.toFixed(1)} minutes old)`);
          return NextResponse.json(
            {
              error: "already_vibed",
              message: `You have already sent a vibe to @${username}`,
              senderWallet: existingVibe.maskedWallet,
            },
            { status: 409 }
          );
        }
      } else {
        // Already claimed - can't send another to same @username from this wallet
        console.log(`[vibe/prepare] Sender already claimed a vibe to @${username}`);
        return NextResponse.json(
          {
            error: "already_vibed",
            message: `You have already sent a vibe to @${username}`,
            senderWallet: existingVibe.maskedWallet,
          },
          { status: 409 }
        );
      }
    }

    // Get next vibe number
    const vibeNumber = await vibeStore.getNextVibeNumber();
    console.log(`[vibe/prepare] Next vibe number: ${vibeNumber}`);

    // Step 1: Create pending vibe record
    await vibeStore.create({
      id: vibeId,
      targetUserId: username,
      targetUsername: username,
      senderWallet,
      maskedWallet,
      vibeNumber,
    });

    console.log(`[vibe/prepare] Created pending vibe: ${vibeId}`);

    // Step 2: Build the mint transaction (sender pays)
    const {
      serializedTransaction,
      blockhash,
      lastValidBlockHeight,
      mintAddress,
      feeLamports,
      feeSol,
    } = await buildMintTransaction({
      senderWallet,
      recipientHandle: username,
      metadataUri: placeholderUri,
    });

    console.log(`[vibe/prepare] Transaction built for mint ${mintAddress}`);

    // Step 3: Store the mint address in the vibe record
    await vibeStore.update(vibeId, { mintAddress });

    console.log(`[vibe/prepare] Complete in ${Date.now() - start}ms`);

    return NextResponse.json({
      vibeId,
      transaction: serializedTransaction,
      blockhash,
      lastValidBlockHeight,
      mintAddress,
      feeLamports,
      feeSol,
    });
  } catch (e) {
    console.error("[vibe/prepare] Error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to prepare vibe" },
      { status: 500 }
    );
  }
}
