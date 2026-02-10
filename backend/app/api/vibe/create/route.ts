/**
 * DEPRECATED: This endpoint is replaced by /api/vibe/prepare and /api/vibe/confirm
 * 
 * The new flow:
 * 1. POST /api/vibe/prepare → returns unsigned transaction
 * 2. Frontend signs with wallet
 * 3. POST /api/vibe/confirm → submits transaction, generates image
 * 
 * This endpoint returns an error directing to the new flow.
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  return NextResponse.json(
    {
      error: "This endpoint is deprecated. Use /api/vibe/prepare and /api/vibe/confirm instead.",
      newFlow: {
        step1: "POST /api/vibe/prepare with { targetUsername, senderWallet }",
        step2: "Sign the returned transaction with wallet",
        step3: "POST /api/vibe/confirm with { vibeId, signedTransaction }",
      },
    },
    { status: 410 } // Gone
  );
}
