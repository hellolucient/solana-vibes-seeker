/**
 * Script to convert a keypair array directly to base58 format.
 * 
 * Usage:
 *   npx tsx scripts/convert-array-to-base58.ts
 * 
 * Then paste your array when prompted: [50,178,101,...]
 */

import * as readline from "readline";
import bs58 from "bs58";

function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log("\n=== Convert Keypair Array to Base58 ===\n");
  console.log("Paste your keypair array (with brackets):");
  console.log("Example: [50,178,101,194,145,74,25,...]\n");
  
  const input = await askQuestion("Keypair array: ");
  
  try {
    // Parse the array
    const keypair = JSON.parse(input.trim());
    
    // Check if it's an array
    if (!Array.isArray(keypair)) {
      console.error("\n❌ Error: Input must be a JSON array");
      process.exit(1);
    }
    
    // Check length (should be 64 for Solana keypair)
    if (keypair.length !== 64) {
      console.error(`\n❌ Error: Expected array of length 64, got ${keypair.length}`);
      process.exit(1);
    }
    
    // Convert to Uint8Array
    const secretKey = new Uint8Array(keypair);
    
    // Encode to base58
    const base58Secret = bs58.encode(secretKey);
    
    console.log("\n✅ Converted to base58 format!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\nAdd this to your .env file:\n");
    console.log(`TREASURY_SECRET=${base58Secret}`);
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("\n⚠️  Keep this secret secure and never commit it to git!\n");
    
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      console.error("\n❌ Error: Invalid JSON format. Make sure you include the brackets [ ]");
      console.error("   Example: [50,178,101,194,145,74,25,...]");
    } else {
      console.error(`\n❌ Error: ${error.message}`);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
