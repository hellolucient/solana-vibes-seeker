/**
 * Build a claim transaction that transfers the NFT to the claimer.
 * 
 * The transaction includes:
 * 1. Transfer instruction (vault -> claimer)
 * 2. Micro-fee transfer to treasury wallet
 * 
 * The authority signs to authorize the NFT transfer.
 * The claimer will sign as fee payer when submitting.
 * 
 * Note: We don't update on-chain status - the transfer itself IS the claim.
 * The database tracks claim status for our application.
 */

import {
  fetchAssetV1,
  transfer,
} from "@metaplex-foundation/mpl-core";
import { transferSol } from "@metaplex-foundation/mpl-toolbox";
import {
  publicKey,
  transactionBuilder,
  createNoopSigner,
  lamports,
} from "@metaplex-foundation/umi";
import { toWeb3JsTransaction } from "@metaplex-foundation/umi-web3js-adapters";
import { getUmi } from "./umi";
import { getTreasuryWallet, getClaimFeeLamports } from "./config";

interface BuildClaimTransactionParams {
  mintAddress: string;
  claimerWallet: string;
}

interface BuildClaimTransactionResult {
  serializedTransaction: string; // base64 encoded
  blockhash: string;
  lastValidBlockHeight: number;
}

export async function buildClaimTransaction({
  mintAddress,
  claimerWallet,
}: BuildClaimTransactionParams): Promise<BuildClaimTransactionResult> {
  const { umi, authority } = getUmi();

  // Create a noop signer for the claimer (they'll sign later on the frontend)
  const claimerSigner = createNoopSigner(publicKey(claimerWallet));

  // Fetch the asset
  const assetPubkey = publicKey(mintAddress);
  const asset = await fetchAssetV1(umi, assetPubkey);
  const newOwner = publicKey(claimerWallet);

  // Build transfer instruction
  // Authority must sign since they own the asset
  // Payer is claimer so they pay any rent costs
  const transferBuilder = transfer(umi, {
    asset,
    newOwner,
    authority: authority,
    payer: claimerSigner,
  });

  // Build micro-fee transfer to treasury
  const claimFee = getClaimFeeLamports();
  const treasury = getTreasuryWallet();
  
  console.log(`[ClaimTx] Adding claim fee: ${claimFee} lamports to ${treasury}`);
  
  const feeTransferBuilder = transferSol(umi, {
    source: claimerSigner,
    destination: treasury,
    amount: lamports(claimFee),
  });

  // Combine instructions into one transaction
  const builder = transactionBuilder()
    .add(transferBuilder)     // Transfer NFT to claimer
    .add(feeTransferBuilder); // Pay the claim fee
  
  // Get a recent blockhash
  const { blockhash, lastValidBlockHeight } = await umi.rpc.getLatestBlockhash();

  // Build the transaction with claimer as fee payer
  const transaction = await builder.setFeePayer(claimerSigner).setBlockhash(blockhash).build(umi);

  // Authority signs the transaction (for transfer/update permissions)
  const signedTransaction = await authority.signTransaction(transaction);

  // Convert to web3.js transaction and serialize
  const web3Transaction = toWeb3JsTransaction(signedTransaction);
  const serialized = web3Transaction.serialize();
  const serializedTransaction = Buffer.from(serialized).toString("base64");

  return {
    serializedTransaction,
    blockhash,
    lastValidBlockHeight: Number(lastValidBlockHeight),
  };
}
