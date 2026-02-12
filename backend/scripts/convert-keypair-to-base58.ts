/**
 * Script to convert a Solana keypair JSON file to base58 format.
 * 
 * Usage:
 *   npx tsx scripts/convert-keypair-to-base58.ts <path-to-keypair.json>
 * 
 * Example:
 *   npx tsx scripts/convert-keypair-to-base58.ts ./treasury-keypair.json
 */

import { readFileSync } from "fs";
import bs58 from "bs58";

const keypairPath = process.argv[2];

if (!keypairPath) {
  console.error("\nError: Please provide the path to the keypair JSON file");
  console.error("\nUsage:");
  console.error("  npx tsx scripts/convert-keypair-to-base58.ts <path-to-keypair.json>");
  console.error("\nExample:");
  console.error("  npx tsx scripts/convert-keypair-to-base58.ts ./treasury-keypair.json");
  process.exit(1);
}

try {
  // Read the keypair file
  const keypairContent = readFileSync(keypairPath, "utf-8");
  const keypair = JSON.parse(keypairContent);
  
  // Check if it's an array (Solana keypair format)
  if (!Array.isArray(keypair) || keypair.length !== 64) {
    console.error("\nError: Invalid keypair format. Expected an array of 64 numbers.");
    process.exit(1);
  }
  
  // Convert to Uint8Array
  const secretKey = new Uint8Array(keypair);
  
  // Encode to base58
  const base58Secret = bs58.encode(secretKey);
  
  console.log("\n✅ Converted keypair to base58 format\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\nAdd this to your .env file:\n");
  console.log(`TREASURY_SECRET=${base58Secret}`);
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n⚠️  Keep this secret secure and never commit it to git!\n");
  
} catch (error: any) {
  if (error.code === "ENOENT") {
    console.error(`\nError: File not found: ${keypairPath}`);
  } else if (error instanceof SyntaxError) {
    console.error(`\nError: Invalid JSON file: ${error.message}`);
  } else {
    console.error(`\nError: ${error.message}`);
  }
  process.exit(1);
}
