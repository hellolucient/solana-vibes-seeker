/**
 * Build a mint transaction for sender-pays flow.
 * 
 * The transaction includes:
 * 1. Create NFT asset instruction (asset signer + authority sign)
 * 2. Micro-fee transfer to treasury (sender pays)
 * 
 * The asset signer and authority sign the transaction (asset creates account, authority owns it).
 * The sender will sign as fee payer when submitting.
 */

import { create } from "@metaplex-foundation/mpl-core";
import { transferSol, setComputeUnitPrice, setComputeUnitLimit } from "@metaplex-foundation/mpl-toolbox";
import {
  publicKey,
  transactionBuilder,
  createNoopSigner,
  generateSigner,
  lamports,
  KeypairSigner,
} from "@metaplex-foundation/umi";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { getUmi } from "./umi";
import { getTreasuryWallet, getMintFeeLamports } from "./config";

interface BuildMintTransactionParams {
  senderWallet: string;
  recipientHandle: string;
  metadataUri: string;
}

interface BuildMintTransactionResult {
  serializedTransaction: string; // base64 encoded
  blockhash: string;
  lastValidBlockHeight: number;
  mintAddress: string;
  feeLamports: string;
  feeSol: number;
}

/**
 * Build a mint transaction where the sender pays.
 * The asset signer signs for NFT creation (creates the account).
 * The sender will sign as fee payer on the frontend.
 * Note: The owner parameter (authority.publicKey) doesn't require the authority to sign the CREATE instruction.
 */
export async function buildMintTransaction({
  senderWallet,
  recipientHandle,
  metadataUri,
}: BuildMintTransactionParams): Promise<BuildMintTransactionResult> {
  const { umi, authority } = getUmi();

  // Create noop signer for the sender (they'll sign on frontend)
  const senderSigner = createNoopSigner(publicKey(senderWallet));

  // Generate a new keypair for the asset
  const assetSigner = generateSigner(umi);

  console.log(`[MintTx] Building mint transaction for @${recipientHandle}`);
  console.log(`[MintTx] Asset address: ${assetSigner.publicKey}`);
  console.log(`[MintTx] Sender: ${senderWallet}`);

  // Build create NFT instruction
  // The asset is owned by the authority (vault) until claimed
  // Sender pays for the account rent (payer field)
  const createBuilder = create(umi, {
    asset: assetSigner,
    name: `Vibe for @${recipientHandle}`,
    uri: metadataUri,
    owner: authority.publicKey, // Authority owns until claimed
    payer: senderSigner, // Sender pays for NFT account rent
    plugins: [
      {
        // Attributes plugin stores on-chain metadata about the vibe
        type: "Attributes",
        attributeList: [
          { key: "recipient_handle", value: recipientHandle },
          { key: "sender_wallet", value: senderWallet },
        ],
      },
    ],
  });

  // Build micro-fee transfer to treasury
  const mintFee = getMintFeeLamports();
  const treasury = getTreasuryWallet();

  console.log(`[MintTx] Adding mint fee: ${mintFee} lamports to ${treasury}`);

  const feeTransferBuilder = transferSol(umi, {
    source: senderSigner,
    destination: treasury,
    amount: lamports(mintFee),
  });

  // Priority fee so tx lands promptly on mainnet (avoids "0 network fee" / deprioritization)
  const priorityFeeBuilder = setComputeUnitPrice(umi, { microLamports: 50_000 });
  const computeLimitBuilder = setComputeUnitLimit(umi, { units: 200_000 });

  // Combine: priority fee first, then mint + transfer (ComputeBudget must be first)
  const builder = transactionBuilder()
    .add(priorityFeeBuilder)
    .add(computeLimitBuilder)
    .add(createBuilder)
    .add(feeTransferBuilder);

  // Get a recent blockhash
  const { blockhash, lastValidBlockHeight } = await umi.rpc.getLatestBlockhash();

  // Build the transaction with sender as fee payer
  const transaction = await builder
    .setFeePayer(senderSigner)
    .setBlockhash(blockhash)
    .build(umi);

  // Asset signer needs to sign (creating a new account)
  // Authority doesn't need to sign the CREATE instruction - owner is just metadata
  // Sender will sign as fee payer on the frontend
  const signedTransaction = await assetSigner.signTransaction(transaction);

  // Convert to web3.js transaction and serialize
  const web3Transaction = toWeb3JsTransaction(signedTransaction);
  const serialized = web3Transaction.serialize();
  const serializedTransaction = Buffer.from(serialized).toString("base64");

  const feeSol = Number(mintFee) / 1_000_000_000;

  console.log(`[MintTx] Transaction built, fee: ${feeSol} SOL`);

  return {
    serializedTransaction,
    blockhash,
    lastValidBlockHeight: Number(lastValidBlockHeight),
    mintAddress: assetSigner.publicKey.toString(),
    feeLamports: mintFee.toString(),
    feeSol,
  };
}
