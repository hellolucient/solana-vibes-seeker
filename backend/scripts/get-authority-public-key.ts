/**
 * Script to derive the Authority wallet public key from VIBE_AUTHORITY_SECRET.
 * 
 * Usage:
 *   VIBE_AUTHORITY_SECRET="your-base58-secret" npx tsx scripts/get-authority-public-key.ts
 * 
 * Or set it in .env file and run:
 *   npx tsx scripts/get-authority-public-key.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import bs58 from "bs58";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";

// Load .env file manually if not already set
if (!process.env.VIBE_AUTHORITY_SECRET) {
  const envPath = resolve(__dirname, "../.env");
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
    process.env.VIBE_AUTHORITY_SECRET = envVars.VIBE_AUTHORITY_SECRET;
  } catch (error) {
    console.error("Could not read .env file. Set VIBE_AUTHORITY_SECRET environment variable.");
    process.exit(1);
  }
}

const authoritySecret = process.env.VIBE_AUTHORITY_SECRET;
if (!authoritySecret) {
  console.error("Error: VIBE_AUTHORITY_SECRET not set");
  process.exit(1);
}

try {
  // Decode the secret key
  const secretKey = bs58.decode(authoritySecret);
  
  // Create a minimal Umi instance just to derive the public key
  const umi = createUmi("https://api.mainnet-beta.solana.com");
  const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
  
  console.log("\n=== Authority Wallet Public Key ===\n");
  console.log(keypair.publicKey.toString());
  console.log("\n");
} catch (error: any) {
  console.error("Error:", error.message);
  process.exit(1);
}
