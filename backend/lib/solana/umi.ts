/**
 * Umi instance configuration for Metaplex Core operations.
 * Uses a backend keypair as the authority for minting and transfers.
 */

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { mplCore } from "@metaplex-foundation/mpl-core";
import {
  createSignerFromKeypair,
  keypairIdentity,
  Umi,
  Signer,
  KeypairSigner,
} from "@metaplex-foundation/umi";
import bs58 from "bs58";

let umiInstance: Umi | null = null;
let authoritySigner: KeypairSigner | null = null;

/**
 * Get or create the Umi instance with backend authority.
 * The authority keypair is used to:
 * - Hold NFTs in "vault" until claimed
 * - Sign transfer transactions on claim
 */
export function getUmi(): { umi: Umi; authority: KeypairSigner } {
  if (umiInstance && authoritySigner) {
    return { umi: umiInstance, authority: authoritySigner };
  }

  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || "https://api.devnet.solana.com";
  const authoritySecret = process.env.VIBE_AUTHORITY_SECRET;

  if (!authoritySecret) {
    throw new Error("VIBE_AUTHORITY_SECRET env var required (base58 encoded keypair)");
  }

  // Decode the secret key
  const secretKey = bs58.decode(authoritySecret);

  // Create Umi instance
  umiInstance = createUmi(rpcUrl).use(mplCore());

  // Create authority keypair from secret
  const keypair = umiInstance.eddsa.createKeypairFromSecretKey(secretKey);
  authoritySigner = createSignerFromKeypair(umiInstance, keypair);

  // Set the authority as the identity/payer
  umiInstance = umiInstance.use(keypairIdentity(authoritySigner));

  console.log(`[Umi] Initialized with authority: ${authoritySigner.publicKey}`);

  return { umi: umiInstance, authority: authoritySigner };
}

/**
 * Get the vault (authority) public key as a base58 string.
 * This is where NFTs are held before claim.
 */
export function getVaultAddress(): string {
  const { authority } = getUmi();
  return authority.publicKey.toString();
}
