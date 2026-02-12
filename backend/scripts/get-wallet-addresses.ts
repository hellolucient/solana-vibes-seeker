/**
 * Script to display the Treasury and Authority wallet addresses.
 * Run with: npx tsx scripts/get-wallet-addresses.ts
 * 
 * Note: Make sure .env file exists in the backend directory
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import bs58 from "bs58";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { publicKey } from "@metaplex-foundation/umi";

// Load .env file manually
const envPath = resolve(__dirname, "../.env");
let envContent: string;
try {
  envContent = readFileSync(envPath, "utf-8");
} catch (error) {
  console.error(`Error: Could not read .env file at ${envPath}`);
  console.error("Make sure the .env file exists in the backend directory.");
  process.exit(1);
}

// Parse .env file
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

// Set environment variables
Object.entries(envVars).forEach(([key, value]) => {
  if (!process.env[key]) {
    process.env[key] = value;
  }
});

function getTreasuryAddress(): string {
  const treasury = process.env.TREASURY_WALLET;
  if (!treasury) {
    throw new Error("TREASURY_WALLET env var not set in .env file");
  }
  return treasury;
}

function getAuthorityAddress(): string {
  // First check if AUTHORITY_WALLET is explicitly set (for convenience)
  if (process.env.AUTHORITY_WALLET) {
    return process.env.AUTHORITY_WALLET;
  }

  // Otherwise derive from VIBE_AUTHORITY_SECRET
  const authoritySecret = process.env.VIBE_AUTHORITY_SECRET;
  if (!authoritySecret) {
    throw new Error("VIBE_AUTHORITY_SECRET env var not set in .env file");
  }

  // Decode the secret key
  const secretKey = bs58.decode(authoritySecret);
  
  // Create a minimal Umi instance just to derive the public key
  const umi = createUmi("https://api.mainnet-beta.solana.com");
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  
  return keypair.publicKey.toString();
}

try {
  console.log("\n=== Wallet Addresses ===\n");
  
  const treasuryAddress = getTreasuryAddress();
  console.log(`Treasury Wallet: ${treasuryAddress}`);
  
  const authorityAddress = getAuthorityAddress();
  console.log(`Authority Wallet: ${authorityAddress}`);
  
  console.log("\n");
} catch (error: any) {
  console.error("Error:", error.message);
  process.exit(1);
}
