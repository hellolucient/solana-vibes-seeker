/**
 * Irys (Arweave) storage for permanent, decentralized NFT storage.
 * 
 * Irys provides permanent storage on Arweave, paid with SOL.
 * Images and metadata are stored forever and can't be deleted.
 * 
 * Setup:
 * 1. Set IRYS_WALLET_SECRET in .env (base58 encoded keypair)
 * 2. Fund your Irys account: https://docs.irys.xyz/developer-docs/irys-sdk/irys-in-the-browser/funding-irys
 * 
 * To fund via CLI:
 * npx @irys/sdk fund <amount-in-lamports> -n mainnet -t solana -w <path-to-keypair.json>
 */

import Irys from "@irys/sdk";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bs58 = require("bs58");

let irysInstance: Irys | null = null;

/**
 * Get or create the Irys instance.
 * Uses the IRYS_WALLET_SECRET for authentication.
 */
async function getIrys(): Promise<Irys> {
  if (irysInstance) {
    return irysInstance;
  }

  const walletSecret = process.env.IRYS_WALLET_SECRET;
  if (!walletSecret) {
    throw new Error("IRYS_WALLET_SECRET env var required for Arweave uploads");
  }

  // Decode base58 secret to Uint8Array
  const secretKey = bs58.decode(walletSecret);

  // Determine network based on RPC
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
  const isMainnet = rpcUrl.toLowerCase().includes("mainnet");

  // Irys node URLs
  // For devnet: use "devnet" node
  // For mainnet: use "mainnet" node
  const irysNode = isMainnet 
    ? "https://node1.irys.xyz" 
    : "https://devnet.irys.xyz";

  console.log(`[Irys] Connecting to ${irysNode}`);

  irysInstance = new Irys({
    url: irysNode,
    token: "solana",
    key: secretKey,
    config: {
      providerUrl: rpcUrl,
    },
  });

  // Check balance
  const balance = await irysInstance.getLoadedBalance();
  console.log(`[Irys] Balance: ${irysInstance.utils.fromAtomic(balance)} SOL`);

  return irysInstance;
}

export interface IrysUploadResult {
  imageUri: string;
  metadataUri: string;
}

/**
 * Upload image and metadata to Arweave via Irys.
 */
export async function uploadToIrys(params: {
  vibeId: string;
  imageBuffer: Buffer;
  metadata: object;
}): Promise<IrysUploadResult> {
  const { vibeId, imageBuffer, metadata } = params;
  const irys = await getIrys();

  console.log(`[Irys] Uploading vibe ${vibeId} to Arweave`);

  // Upload image
  const imagePrice = await irys.getPrice(imageBuffer.length);
  console.log(`[Irys] Image upload price: ${irys.utils.fromAtomic(imagePrice)} SOL`);

  const imageTx = await irys.upload(imageBuffer, {
    tags: [
      { name: "Content-Type", value: "image/png" },
      { name: "App-Name", value: "solana-vibes" },
      { name: "Vibe-ID", value: vibeId },
    ],
  });

  const imageUri = `https://arweave.net/${imageTx.id}`;
  console.log(`[Irys] Image uploaded: ${imageUri}`);

  // Update metadata with Arweave image URL
  const finalMetadata = {
    ...metadata,
    image: imageUri,
  };

  // Upload metadata JSON
  const metadataBuffer = Buffer.from(JSON.stringify(finalMetadata, null, 2));
  const metadataPrice = await irys.getPrice(metadataBuffer.length);
  console.log(`[Irys] Metadata upload price: ${irys.utils.fromAtomic(metadataPrice)} SOL`);

  const metadataTx = await irys.upload(metadataBuffer, {
    tags: [
      { name: "Content-Type", value: "application/json" },
      { name: "App-Name", value: "solana-vibes" },
      { name: "Vibe-ID", value: vibeId },
    ],
  });

  const metadataUri = `https://arweave.net/${metadataTx.id}`;
  console.log(`[Irys] Metadata uploaded: ${metadataUri}`);

  return {
    imageUri,
    metadataUri,
  };
}

/**
 * Get current Irys balance in SOL.
 */
export async function getIrysBalance(): Promise<string> {
  const irys = await getIrys();
  const balance = await irys.getLoadedBalance();
  return irys.utils.fromAtomic(balance).toString();
}

/**
 * Estimate upload cost for a given size in bytes.
 */
export async function estimateUploadCost(sizeBytes: number): Promise<string> {
  const irys = await getIrys();
  const price = await irys.getPrice(sizeBytes);
  return irys.utils.fromAtomic(price).toString();
}
