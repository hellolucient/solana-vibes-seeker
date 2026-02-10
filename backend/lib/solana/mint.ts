/**
 * Metaplex Core NFT operations for vibes.
 * 
 * Flow:
 * 1. Create asset with authority as owner (vault)
 * 2. Asset is held until claimed
 * 3. On claim, transfer to recipient wallet
 * 
 * Note: Uses polling-based confirmation instead of WebSocket subscriptions
 * for compatibility with Vercel's serverless environment.
 */

import {
  fetchAssetV1,
  transfer,
  update,
  AssetV1,
} from "@metaplex-foundation/mpl-core";
import {
  publicKey,
  Umi,
  TransactionBuilder,
} from "@metaplex-foundation/umi";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { getUmi } from "./umi";

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
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Update the metadata URI of a vibe NFT.
 * Called after the final image is generated and uploaded.
 * Includes retry logic for RPC lag.
 */
export async function updateVibeMetadata(
  mintAddress: string,
  newUri: string
): Promise<string> {
  const { umi } = getUmi();

  console.log(`[Mint] Updating metadata for ${mintAddress} to ${newUri}`);

  const assetPubkey = publicKey(mintAddress);
  
  // Retry fetching the asset with delays (RPC can lag behind)
  let asset = null;
  const maxRetries = 5;
  const delayMs = 2000;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      asset = await fetchAssetV1(umi, assetPubkey);
      break;
    } catch (e) {
      if (attempt === maxRetries) {
        console.error(`[Mint] Failed to fetch asset after ${maxRetries} attempts`);
        throw e;
      }
      console.log(`[Mint] Asset not found, retrying in ${delayMs}ms (attempt ${attempt}/${maxRetries})`);
      await sleep(delayMs);
    }
  }

  if (!asset) {
    throw new Error(`Asset ${mintAddress} not found after retries`);
  }

  const builder = update(umi, {
    asset,
    uri: newUri,
  });

  const { signature } = await sendAndConfirmWithPolling(umi, builder);
  const signatureB64 = Buffer.from(signature).toString("base64");

  console.log(`[Mint] Metadata updated, sig: ${signatureB64}`);

  return signatureB64;
}

/**
 * Transfer a vibe NFT from the vault to the claimer.
 * Only called after Twitter verification passes.
 */
export async function transferVibeToClaimer(
  mintAddress: string,
  claimerWallet: string
): Promise<string> {
  const { umi } = getUmi();

  console.log(`[Mint] Transferring ${mintAddress} to ${claimerWallet}`);

  // Fetch the asset to get full object for transfer
  const assetPubkey = publicKey(mintAddress);
  const asset = await fetchAssetV1(umi, assetPubkey);
  const newOwner = publicKey(claimerWallet);

  const builder = transfer(umi, {
    asset,
    newOwner,
  });

  const { signature } = await sendAndConfirmWithPolling(umi, builder);
  const signatureB64 = Buffer.from(signature).toString("base64");

  console.log(`[Mint] Transfer complete, sig: ${signatureB64}`);

  return signatureB64;
}

/**
 * Fetch asset data to verify ownership and claim status.
 */
export async function getVibeAsset(mintAddress: string): Promise<AssetV1 | null> {
  const { umi } = getUmi();

  try {
    const asset = await fetchAssetV1(umi, publicKey(mintAddress));
    return asset;
  } catch (e) {
    console.error(`[Mint] Failed to fetch asset ${mintAddress}:`, e);
    return null;
  }
}

/**
 * Check if an asset is still in the vault (not yet claimed).
 */
export async function isVibeInVault(mintAddress: string): Promise<boolean> {
  const { umi, authority } = getUmi();

  try {
    const asset = await fetchAssetV1(umi, publicKey(mintAddress));
    return asset.owner.toString() === authority.publicKey.toString();
  } catch {
    return false;
  }
}
