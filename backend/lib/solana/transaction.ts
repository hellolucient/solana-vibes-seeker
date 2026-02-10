/**
 * Transaction utilities for minting vibes.
 * 
 * MVP: Backend authority pays for minting (simpler).
 * TODO: Enhance to true sender-pays with partial signing.
 * 
 * Note: Uses polling-based confirmation instead of WebSocket subscriptions
 * for compatibility with Vercel's serverless environment.
 */

import { create } from "@metaplex-foundation/mpl-core";
import {
  generateSigner,
  Umi,
  TransactionBuilder,
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { getUmi } from "./umi";

/**
 * Sleep helper for polling.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Send a transaction and confirm it using HTTP polling (not WebSockets).
 * This is required for Vercel/serverless environments where WebSocket
 * subscriptions don't work properly.
 */
async function sendAndConfirmWithPolling(
  umi: Umi,
  builder: TransactionBuilder,
  maxRetries = 60,
  retryDelayMs = 500
): Promise<{ signature: Uint8Array }> {
  // Build, sign, and send the transaction
  const signedTx = await builder.buildAndSign(umi);
  const signature = await umi.rpc.sendTransaction(signedTx);
  
  const signatureStr = base58.deserialize(signature)[0];
  console.log(`[TX] Sent transaction: ${signatureStr}`);
  
  // Poll for confirmation using getSignatureStatuses (HTTP, not WebSocket)
  for (let i = 0; i < maxRetries; i++) {
    const statuses = await umi.rpc.getSignatureStatuses([signature]);
    const status = statuses[0];
    
    if (status) {
      if (status.error) {
        throw new Error(`Transaction failed: ${JSON.stringify(status.error)}`);
      }
      
      // Check if confirmed (confirmations is not null means it has been confirmed)
      if (status.confirmations !== null) {
        console.log(`[TX] Confirmed with ${status.confirmations} confirmations`);
        return { signature };
      }
    }
    
    // Wait before polling again
    await sleep(retryDelayMs);
  }
  
  throw new Error(`Transaction confirmation timed out after ${maxRetries * retryDelayMs}ms`);
}

/**
 * Mint a vibe NFT directly (backend pays).
 * Returns the mint address and signature.
 */
export async function mintVibe(params: {
  senderWallet: string;
  recipientHandle: string;
  uri: string;
}): Promise<{
  mintAddress: string;
  signature: string;
}> {
  const { umi, authority } = getUmi();

  // Generate a new keypair for the asset
  const assetSigner = generateSigner(umi);

  console.log(`[MintVibe] Creating asset ${assetSigner.publicKey} for @${params.recipientHandle}`);

  // Build and send the create instruction
  const builder = create(umi, {
    asset: assetSigner,
    name: `Vibe for @${params.recipientHandle}`,
    uri: params.uri,
    owner: authority.publicKey, // Authority owns until claimed
    plugins: [
      {
        type: "Attributes",
        attributeList: [
          { key: "recipient_handle", value: params.recipientHandle },
          { key: "sender_wallet", value: params.senderWallet },
          { key: "status", value: "pending" },
        ],
      },
    ],
  });

  try {
    const { signature } = await sendAndConfirmWithPolling(umi, builder);
    const signatureB64 = Buffer.from(signature).toString("base64");

    console.log(`[MintVibe] Asset created: ${assetSigner.publicKey}, sig: ${signatureB64}`);

    return {
      mintAddress: assetSigner.publicKey.toString(),
      signature: signatureB64,
    };
  } catch (e) {
    console.error(`[MintVibe] Transaction failed:`, e);
    throw e;
  }
}
