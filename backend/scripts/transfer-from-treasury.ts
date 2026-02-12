/**
 * Script to transfer SOL from the Treasury wallet to another address.
 * 
 * Usage (with arguments):
 *   TREASURY_SECRET="your-base58-secret-key" npx tsx scripts/transfer-from-treasury.ts <destination> <amount-in-sol>
 * 
 * Usage (interactive - prompts for input):
 *   TREASURY_SECRET="your-base58-secret-key" npx tsx scripts/transfer-from-treasury.ts
 * 
 * Example:
 *   TREASURY_SECRET="..." npx tsx scripts/transfer-from-treasury.ts 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU 1.5
 * 
 * Note: The TREASURY_SECRET should be the private key (base58 encoded) for the treasury wallet.
 * This is different from TREASURY_WALLET which is just the public address.
 * You can also add TREASURY_SECRET to your .env file.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import * as readline from "readline";
import bs58 from "bs58";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { transferSol } from "@metaplex-foundation/mpl-toolbox";
import { publicKey, lamports, transactionBuilder, keypairIdentity, createSignerFromKeypair } from "@metaplex-foundation/umi";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";

/**
 * Prompt user for input
 */
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
  // Load .env file manually if TREASURY_SECRET not set
  if (!process.env.TREASURY_SECRET) {
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
      process.env.TREASURY_SECRET = envVars.TREASURY_SECRET;
    } catch (error) {
      console.error("Could not read .env file. Set TREASURY_SECRET environment variable.");
    }
  }

  const treasurySecret = process.env.TREASURY_SECRET;
  if (!treasurySecret) {
    console.error("\nError: TREASURY_SECRET not set");
    console.error("\nUsage:");
    console.error("  TREASURY_SECRET=\"your-base58-secret-key\" npx tsx scripts/transfer-from-treasury.ts <destination> <amount-in-sol>");
    console.error("\nOr add TREASURY_SECRET to your .env file.");
    console.error("\nNote: This is the PRIVATE KEY for the treasury wallet, not the public address.");
    process.exit(1);
  }

  // Get destination and amount from command line args, or prompt interactively
  // Check for --yes flag to skip confirmation
  const skipConfirmation = process.argv.includes("--yes") || process.argv.includes("-y");
  const args = process.argv.filter(arg => !arg.startsWith("--") && !arg.startsWith("-"));
  let destination = args[2];
  let amountStr = args[3];

  async function getTransferDetails() {
    // If arguments provided, use them
    if (destination && amountStr) {
      return { destination, amountStr };
    }

    // Otherwise, prompt interactively
    console.log("\n=== Treasury Wallet Transfer ===\n");
    
    if (!destination) {
      destination = await askQuestion("Enter destination wallet address: ");
    }
    
    if (!amountStr) {
      amountStr = await askQuestion("Enter amount to transfer (in SOL): ");
    }
    
    return { destination, amountStr };
  }

  const { destination: finalDestination, amountStr: finalAmountStr } = await getTransferDetails();

  if (!finalDestination || !finalAmountStr) {
    console.error("\nError: Missing required information");
    process.exit(1);
  }

  const amount = parseFloat(finalAmountStr);
  if (isNaN(amount) || amount <= 0) {
    console.error("Error: Amount must be a positive number");
    process.exit(1);
  }

  try {
    // Decode the treasury secret key
    const secretKey = bs58.decode(treasurySecret);
    
    // Get RPC URL from env or use default
    const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.mainnet-beta.solana.com";
    
    // Create Umi instance
    const umi = createUmi(rpcUrl);
    
    // Create keypair from secret
    const keypair = umi.eddsa.createKeypairFromSecretKey(secretKey);
    const treasurySigner = createSignerFromKeypair(umi, keypair);
    
    // Set as identity (payer) - this makes it the default signer and fee payer
    umi.use(keypairIdentity(treasurySigner));
    
    console.log("\n=== Transfer Summary ===\n");
    console.log(`From: ${treasurySigner.publicKey.toString()}`);
    console.log(`To:   ${finalDestination}`);
    console.log(`Amount: ${amount} SOL`);
    
    // Validate destination address
    try {
      publicKey(finalDestination);
    } catch {
      console.error(`\nError: Invalid destination address: ${finalDestination}`);
      process.exit(1);
    }
    
    // Confirm before sending (unless --yes flag is set)
    if (!skipConfirmation) {
      const confirm = await askQuestion("\nConfirm transfer? (yes/no): ");
      if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
        console.log("Transfer cancelled.");
        process.exit(0);
      }
    } else {
      console.log("\n⚠️  Auto-confirming transfer (--yes flag set)...");
    }
    
    // Convert SOL to lamports
    const amountLamports = BigInt(Math.floor(amount * 1_000_000_000));
    
    // Build transfer transaction
    const builder = transferSol(umi, {
      source: treasurySigner,
      destination: publicKey(finalDestination),
      amount: lamports(amountLamports),
    });
    
    // Get recent blockhash
    const { blockhash } = await umi.rpc.getLatestBlockhash();
    
    // Build and sign transaction
    const transaction = await builder.setFeePayer(treasurySigner).setBlockhash(blockhash).build(umi);
    const signedTransaction = await treasurySigner.signTransaction(transaction);
    
    // Send transaction
    console.log("\nSending transaction...");
    const signature = await umi.rpc.sendTransaction(signedTransaction);
    
    console.log(`\n✅ Transaction sent!`);
    console.log(`Signature: ${signature.toString()}`);
    console.log(`\nView on Solana Explorer:`);
    const explorerUrl = rpcUrl.includes("devnet")
      ? `https://explorer.solana.com/tx/${signature.toString()}?cluster=devnet`
      : `https://explorer.solana.com/tx/${signature.toString()}`;
    console.log(explorerUrl);
    console.log("\n");
    
    // Wait for confirmation
    console.log("Waiting for confirmation...");
    let confirmed = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statuses = await umi.rpc.getSignatureStatuses([signature]);
      const status = statuses[0];
      if (status && status.confirmations !== null) {
        confirmed = true;
        console.log(`✅ Transaction confirmed with ${status.confirmations} confirmations`);
        break;
      }
    }
    
    if (!confirmed) {
      console.log("⚠️  Transaction sent but confirmation timed out. Check the explorer link above.");
    }
    
  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    if (error.logs) {
      console.error("\nTransaction logs:");
      error.logs.forEach((log: string) => console.error(`  ${log}`));
    }
    process.exit(1);
  }
}

// Run the main function
main().catch((error) => {
  console.error("\n❌ Unexpected error:", error);
  process.exit(1);
});
