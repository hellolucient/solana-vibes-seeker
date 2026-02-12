/**
 * API endpoint to get Treasury and Authority wallet addresses.
 * GET /api/wallets/addresses
 */

import { NextResponse } from "next/server";
import { getTreasuryWallet } from "@/lib/solana/config";
import { getVaultAddress } from "@/lib/solana/umi";

export async function GET() {
  try {
    const treasuryAddress = getTreasuryWallet().toString();
    const authorityAddress = getVaultAddress();

    return NextResponse.json({
      treasury: treasuryAddress,
      authority: authorityAddress,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
