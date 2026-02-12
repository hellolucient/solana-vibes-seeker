/**
 * Script to check the balance of the treasury wallet.
 * 
 * Usage:
 *   npx tsx scripts/check-treasury-balance.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";

// Load .env file
const envPath = resolve(__dirname, "../.env");
let treasuryAddress: string;

try {
  const envContent = readFileSync(envPath, "utf-8");
  const envVars: Record<string, string> = {};
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith("#")) {
      const [key, ...valueParts] = trimmed.split("=");
      if (key && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join("=").trim();
      }
    }
  });
  treasuryAddress = envVars.TREASURY_WALLET;
} catch (error) {
  console.error("Could not read .env file.");
  process.exit(1);
}

if (!treasuryAddress) {
  console.error("TREASURY_WALLET not found in .env file");
  process.exit(1);
}

async function main() {
  // Get RPC URL from env or use default
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";
  
  console.log("\n=== Treasury Wallet Balance ===\n");
  console.log(`Address: ${treasuryAddress}`);
  console.log(`Network: ${rpcUrl.includes("devnet") ? "Devnet" : "Mainnet"}`);
  console.log("\nChecking balance...\n");
  
  try {
    // Create Umi instance
    const umi = createUmi(rpcUrl);
    
    // Get balance
    const balance = await umi.rpc.getBalance(publicKey(treasuryAddress));
    const balanceSOL = Number(balance.basisPoints) / 1_000_000_000;
    
    console.log(`Balance: ${balanceSOL.toFixed(9)} SOL`);
    console.log(`        ${balance.basisPoints.toString()} lamports`);
    
    if (balanceSOL === 0) {
      console.log("\n💡 This wallet has no funds. You can safely create a new treasury wallet.");
    } else {
      console.log(`\n⚠️  WARNING: This wallet has ${balanceSOL.toFixed(9)} SOL`);
      console.log("   If you don't have the private key, these funds will be inaccessible.");
      console.log("   Make sure you can access this wallet before creating a new one!");
    }
    
    console.log("\n");
  } catch (error: any) {
    console.error("❌ Error checking balance:", error.message);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
