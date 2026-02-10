/**
 * Image and metadata upload for vibes.
 * 
 * Storage is determined by network:
 * - Mainnet: Irys/Arweave (permanent, decentralized)
 * - Devnet: Vercel Blob or local filesystem
 * 
 * Both IRYS_WALLET_SECRET and BLOB_READ_WRITE_TOKEN can be set,
 * and the code will pick the right one based on the Solana network.
 */

import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { uploadToIrys } from "./irys";
import { isMainnet } from "../solana/config";

/**
 * Determine which storage backend to use based on network and available credentials.
 * 
 * TODO: Re-enable Irys once we fix the upload persistence issue.
 * For now, using Vercel Blob on all networks for reliability.
 */
function getStorageBackend(): "irys" | "blob" | "local" {
  // Temporarily disabled Irys due to upload persistence issues
  // const hasIrys = !!process.env.IRYS_WALLET_SECRET;
  const hasIrys = false; // TEMP: Force disable Irys
  const hasBlob = !!process.env.BLOB_READ_WRITE_TOKEN;
  const mainnet = isMainnet();

  if (mainnet) {
    // Mainnet: use Blob for now (Irys disabled temporarily)
    if (hasIrys) {
      return "irys";
    }
    if (hasBlob) {
      console.log("[Upload] Using Vercel Blob on mainnet");
      return "blob";
    }
    throw new Error("Mainnet requires BLOB_READ_WRITE_TOKEN for storage (Irys temporarily disabled)");
  } else {
    // Devnet: prefer Blob, fallback to local
    if (hasBlob) {
      return "blob";
    }
    return "local";
  }
}

// Local directories for dev
const VIBES_DIR = path.join(process.cwd(), "public", "media", "vibes");
const METADATA_DIR = path.join(process.cwd(), "public", "media", "metadata");

async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export interface VibeMetadata {
  name: string;
  description: string;
  image: string;
  external_url: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

export interface UploadResult {
  imageUri: string;
  metadataUri: string;
}

/**
 * Upload vibe image and metadata.
 * Automatically picks storage based on network:
 * - Mainnet → Irys/Arweave
 * - Devnet → Vercel Blob or local
 */
export async function uploadVibeAssets(params: {
  vibeId: string;
  imageBuffer: Buffer;
  metadata: VibeMetadata;
  baseUrl: string;
}): Promise<UploadResult> {
  const { vibeId, imageBuffer, metadata } = params;
  const backend = getStorageBackend();

  console.log(`[Upload] Using ${backend} storage for ${vibeId}`);

  switch (backend) {
    case "irys":
      return uploadToIrys({ vibeId, imageBuffer, metadata });
    case "blob":
      return uploadToBlobStorage(params);
    case "local":
      return uploadToLocalFilesystem(params);
  }
}

/**
 * Upload to Vercel Blob (production)
 */
async function uploadToBlobStorage(params: {
  vibeId: string;
  imageBuffer: Buffer;
  metadata: VibeMetadata;
  baseUrl: string;
}): Promise<UploadResult> {
  const { vibeId, imageBuffer, metadata } = params;

  console.log(`[Upload] Using Vercel Blob for ${vibeId}`);

  // Upload image to Blob
  const imageBlob = await put(`vibes/${vibeId}.png`, imageBuffer, {
    access: "public",
    contentType: "image/png",
  });
  console.log(`[Upload] Image uploaded to Blob: ${imageBlob.url}`);

  // Update metadata with blob image URL
  const finalMetadata: VibeMetadata = {
    ...metadata,
    image: imageBlob.url,
  };

  // Upload metadata JSON to Blob
  const metadataBlob = await put(
    `metadata/${vibeId}.json`,
    JSON.stringify(finalMetadata, null, 2),
    {
      access: "public",
      contentType: "application/json",
    }
  );
  console.log(`[Upload] Metadata uploaded to Blob: ${metadataBlob.url}`);

  return {
    imageUri: imageBlob.url,
    metadataUri: metadataBlob.url,
  };
}

/**
 * Upload to local filesystem (development)
 */
async function uploadToLocalFilesystem(params: {
  vibeId: string;
  imageBuffer: Buffer;
  metadata: VibeMetadata;
  baseUrl: string;
}): Promise<UploadResult> {
  const { vibeId, imageBuffer, metadata, baseUrl } = params;

  console.log(`[Upload] Using local filesystem for ${vibeId}`);

  await ensureDir(VIBES_DIR);
  await ensureDir(METADATA_DIR);

  // Write image
  const imagePath = path.join(VIBES_DIR, `${vibeId}.png`);
  await writeFile(imagePath, imageBuffer);
  console.log(`[Upload] Image saved: ${imagePath}`);

  const imageUri = `${baseUrl}/media/vibes/${vibeId}.png`;

  // Update metadata with final image URI
  const finalMetadata: VibeMetadata = {
    ...metadata,
    image: imageUri,
  };

  // Write metadata JSON
  const metadataPath = path.join(METADATA_DIR, `${vibeId}.json`);
  await writeFile(metadataPath, JSON.stringify(finalMetadata, null, 2));
  console.log(`[Upload] Metadata saved: ${metadataPath}`);

  const metadataUri = `${baseUrl}/media/metadata/${vibeId}.json`;

  return {
    imageUri,
    metadataUri,
  };
}

/**
 * Generate NFT metadata for a vibe.
 */
export function createVibeMetadata(params: {
  vibeId: string;
  recipientHandle: string;
  senderWallet: string;
  maskedWallet: string;
  mintAddress: string;
  timestamp: string;
  baseUrl: string;
  vibeNumber?: number;
}): VibeMetadata {
  const { vibeId, recipientHandle, maskedWallet, mintAddress, timestamp, baseUrl, vibeNumber } =
    params;

  const handle = recipientHandle.startsWith("@") ? recipientHandle : `@${recipientHandle}`;
  const nameWithNumber = vibeNumber ? `Vibe #${vibeNumber} for ${handle}` : `Vibe for ${handle}`;
  const descWithNumber = vibeNumber
    ? `solana_vibes #${vibeNumber} sent to ${handle}. Verified by wallet ${maskedWallet}.`
    : `A solana_vibe sent to ${handle}. Verified by wallet ${maskedWallet}.`;

  const attributes = [
    { trait_type: "Recipient", value: handle },
    { trait_type: "Sender Wallet", value: maskedWallet },
    { trait_type: "Mint", value: mintAddress },
    { trait_type: "Created", value: timestamp },
  ];

  // Add vibe number if available
  if (vibeNumber) {
    attributes.unshift({ trait_type: "Vibe Number", value: `#${vibeNumber}` });
  }

  return {
    name: nameWithNumber,
    description: descWithNumber,
    image: "", // Will be set during upload
    external_url: `${baseUrl}/v/${vibeId}`,
    attributes,
  };
}
