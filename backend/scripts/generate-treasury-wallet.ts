/**
 * Script to generate a new treasury wallet keypair.
 * 
 * This will create a new Solana keypair and display:
 * - Public address (to use as TREASURY_WALLET)
 * - Base58-encoded secret key (to use as TREASURY_SECRET)
 * 
 * Usage:
 *   npx tsx scripts/generate-treasury-wallet.ts
 * 
 * IMPORTANT: Save both values securely! The secret key is needed to transfer funds.
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { generateSigner } from "@metaplex-foundation/umi";
import bs58 from "bs58";

async function main() {
  console.log("\n=== Generating New Treasury Wallet ===\n");

  // Create Umi instance (network doesn't matter for key generation)
  const umi = createUmi("https://api.mainnet-beta.solana.com");
  
  // Generate a new keypair
  const keypair = generateSigner(umi);
  
  // Get the secret key (64 bytes: 32 byte secret + 32 byte public key)
  const secretKey = keypair.secretKey;
  
  // Encode to base58 for storage
  const secretKeyBase58 = bs58.encode(secretKey);
  
  console.log("✅ New treasury wallet generated!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n📋 Add these to your .env file:\n");
  console.log(`TREASURY_WALLET=${keypair.publicKey.toString()}`);
  console.log(`TREASURY_SECRET=${secretKeyBase58}`);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n⚠️  IMPORTANT SECURITY NOTES:\n");
  console.log("1. Keep TREASURY_SECRET secure and NEVER commit it to git");
  console.log("2. Store it in a password manager or secure location");
  console.log("3. You'll need TREASURY_SECRET to transfer funds out later");
  console.log("4. Fund this wallet with SOL to receive fees");
  console.log("\n💡 To fund the wallet:");
  console.log(`   Send SOL to: ${keypair.publicKey.toString()}`);
  console.log("\n");
}

main().catch((error) => {
  console.error("\n❌ Error:", error);
  process.exit(1);
});
