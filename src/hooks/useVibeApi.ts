import {useCallback} from 'react';
import {
  Transaction,
  VersionedTransaction,
  VersionedMessage,
} from '@solana/web3.js';

// Use your deployed backend
const API_BASE_URL =
  process.env.API_BASE_URL || 'https://solana-vibes.vercel.app';

/**
 * Deserialize a transaction from a base64 string.
 * Handles both legacy and versioned (v0) transactions.
 */
function deserializeTransaction(
  base64Tx: string,
): Transaction | VersionedTransaction {
  const txBytes = Buffer.from(base64Tx, 'base64');
  try {
    // Try versioned transaction first (v0+)
    return VersionedTransaction.deserialize(txBytes);
  } catch {
    // Fall back to legacy transaction
    return Transaction.from(txBytes);
  }
}

interface PrepareVibeParams {
  targetUsername: string;
  senderWallet: string;
}

interface PrepareVibeResult {
  vibeId: string;
  transaction: Transaction | VersionedTransaction;
}

interface ConfirmVibeParams {
  vibeId: string;
  signedTransaction: Transaction | VersionedTransaction;
}

interface ConfirmVibeResult {
  vibeId: string;
  claimUrl: string;
  mintAddress: string;
}

interface PrepareClaimParams {
  vibeId: string;
  claimerWallet: string;
}

interface PrepareClaimResult {
  transaction: Transaction | VersionedTransaction;
}

interface VibeDetails {
  id: string;
  targetUsername: string;
  senderWallet: string;
  maskedWallet: string;
  vibeNumber: number;
  imageUrl: string;
  claimStatus: 'pending' | 'claimed';
}

export function useVibeApi() {
  /**
   * Prepare a vibe minting transaction
   */
  const prepareVibe = useCallback(
    async (params: PrepareVibeParams): Promise<PrepareVibeResult> => {
      const response = await fetch(`${API_BASE_URL}/api/vibe/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetUsername: params.targetUsername,
          senderWallet: params.senderWallet,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to prepare vibe');
      }

      const data = await response.json();

      // Deserialize the transaction (handles both legacy and versioned)
      const transaction = deserializeTransaction(data.transaction);

      return {
        vibeId: data.vibeId,
        transaction,
      };
    },
    [],
  );

  /**
   * Confirm vibe after signing
   */
  const confirmVibe = useCallback(
    async (params: ConfirmVibeParams): Promise<ConfirmVibeResult> => {
      // Serialize the signed transaction
      const txBuffer = params.signedTransaction.serialize();
      const txBase64 = Buffer.from(txBuffer).toString('base64');

      const response = await fetch(`${API_BASE_URL}/api/vibe/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vibeId: params.vibeId,
          signedTransaction: txBase64,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to confirm vibe');
      }

      return response.json();
    },
    [],
  );

  /**
   * Get vibe details by ID
   */
  const getVibeDetails = useCallback(
    async (vibeId: string): Promise<VibeDetails> => {
      const response = await fetch(`${API_BASE_URL}/api/vibe/${vibeId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to get vibe details');
      }

      return response.json();
    },
    [],
  );

  /**
   * Prepare a claim transaction
   */
  const prepareClaim = useCallback(
    async (params: PrepareClaimParams): Promise<PrepareClaimResult> => {
      const response = await fetch(`${API_BASE_URL}/api/vibe/claim/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vibeId: params.vibeId,
          claimerWallet: params.claimerWallet,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to prepare claim');
      }

      const data = await response.json();

      // Deserialize the transaction (handles both legacy and versioned)
      const transaction = deserializeTransaction(data.transaction);

      return {
        transaction,
      };
    },
    [],
  );

  /**
   * Confirm claim after signing
   */
  const confirmClaim = useCallback(
    async (params: ConfirmVibeParams): Promise<void> => {
      const txBuffer = params.signedTransaction.serialize();
      const txBase64 = Buffer.from(txBuffer).toString('base64');

      const response = await fetch(`${API_BASE_URL}/api/vibe/claim/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vibeId: params.vibeId,
          signedTransaction: txBase64,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Failed to confirm claim');
      }
    },
    [],
  );

  return {
    prepareVibe,
    confirmVibe,
    getVibeDetails,
    prepareClaim,
    confirmClaim,
  };
}
