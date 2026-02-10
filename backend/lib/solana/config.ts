/**
 * Solana configuration for fees, treasury, and network settings.
 */

import { publicKey, PublicKey } from "@metaplex-foundation/umi";

/**
 * Get the treasury wallet public key.
 * This is where micro-fees are collected.
 */
export function getTreasuryWallet(): PublicKey {
  const treasury = process.env.TREASURY_WALLET;
  if (!treasury) {
    throw new Error("TREASURY_WALLET env var required");
  }
  return publicKey(treasury);
}

/**
 * Get the mint fee in lamports.
 * Default: 0.002 SOL (2,000,000 lamports) ≈ $0.30
 */
export function getMintFeeLamports(): bigint {
  const fee = process.env.MINT_FEE_LAMPORTS;
  return BigInt(fee || "2000000");
}

/**
 * Get the claim fee in lamports.
 * Default: 0.001 SOL (1,000,000 lamports) ≈ $0.15
 */
export function getClaimFeeLamports(): bigint {
  const fee = process.env.CLAIM_FEE_LAMPORTS;
  return BigInt(fee || "1000000");
}

/**
 * Get the RPC URL.
 * Defaults to devnet for development.
 */
export function getRpcUrl(): string {
  return process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
}

/**
 * Check if we're on mainnet based on RPC URL.
 */
export function isMainnet(): boolean {
  const rpc = getRpcUrl().toLowerCase();
  return rpc.includes("mainnet");
}
