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

/**
 * Serialize a signed transaction to base64, handling both legacy and versioned
 * transactions, and raw byte arrays from MWA.
 */
function serializeSignedTransaction(
  tx: Transaction | VersionedTransaction,
): string {
  try {
    let txBytes: Uint8Array | Buffer;

    if (tx instanceof VersionedTransaction) {
      // VersionedTransaction.serialize() doesn't verify signatures by default
      txBytes = tx.serialize();
    } else if (tx instanceof Transaction) {
      // Legacy Transaction: disable signature verification since the backend
      // may need to co-sign before submitting
      txBytes = tx.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
    } else if (tx instanceof Uint8Array || ArrayBuffer.isView(tx)) {
      // MWA might return raw bytes in some cases
      txBytes = tx as Uint8Array;
    } else {
      // Unknown format — try to extract bytes
      console.warn('Unknown signed transaction format:', typeof tx);
      txBytes = Buffer.from(JSON.stringify(tx));
    }

    return Buffer.from(txBytes).toString('base64');
  } catch (err) {
    console.error('Failed to serialize signed transaction:', err);
    throw new Error(
      `Failed to serialize signed transaction: ${err instanceof Error ? err.message : 'unknown error'}`,
    );
  }
}

/**
 * Retry a fetch call with delays. Used after MWA signing when the app
 * resumes from background and the network connection may be stale.
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries: number = 3,
  initialDelayMs: number = 1000,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      // Wait before retrying, with exponential backoff
      const delay = initialDelayMs * Math.pow(2, attempt - 1);
      console.log(`Retry attempt ${attempt}/${maxRetries} after ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      const isNetworkError =
        lastError.message.includes('Network request failed') ||
        lastError.message.includes('network') ||
        lastError.message.includes('Failed to fetch') ||
        lastError.message.includes('timeout');

      if (!isNetworkError || attempt === maxRetries) {
        throw lastError;
      }
      console.warn(`Network error on attempt ${attempt + 1}: ${lastError.message}`);
    }
  }

  throw lastError || new Error('Request failed after retries');
}

/**
 * Extract a meaningful error message from an API error response.
 * Handles various backend response formats.
 */
async function extractApiError(
  response: Response,
  fallbackMessage: string,
): Promise<string> {
  try {
    const body = await response.json();
    // Try common error response fields
    const message =
      body.message ||
      body.error?.message ||
      body.error ||
      body.detail ||
      body.reason;
    if (typeof message === 'string' && message.length > 0) {
      return message;
    }
    // If the body has useful info but not in expected fields, stringify it
    const bodyStr = JSON.stringify(body);
    if (bodyStr !== '{}') {
      console.warn('Unrecognized error response format:', bodyStr);
    }
  } catch {
    // Response wasn't valid JSON -- try reading as plain text
    try {
      const text = await response.text();
      if (text && text.length > 0 && text.length < 200) {
        return text;
      }
    } catch {
      // ignore
    }
  }
  return `${fallbackMessage} (HTTP ${response.status})`;
}

interface PrepareVibeParams {
  targetUsername: string;
  senderWallet: string;
}

interface PrepareVibeResult {
  vibeId: string;
  transaction: Transaction | VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: number;
}

interface ConfirmVibeParams {
  vibeId: string;
  signedTransaction: Transaction | VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: number;
}

interface ConfirmVibeResult {
  vibeId: string;
  vibeUrl: string;
  mintAddress: string;
}

interface PrepareClaimParams {
  vibeId: string;
  claimerWallet: string;
}

interface PrepareClaimResult {
  transaction: Transaction | VersionedTransaction;
  blockhash: string;
  lastValidBlockHeight: number;
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
        throw new Error(
          await extractApiError(response, 'Failed to prepare vibe'),
        );
      }

      const data = await response.json();

      if (!data.transaction || !data.vibeId) {
        throw new Error('Invalid response from server — missing transaction data');
      }

      // Deserialize the transaction (handles both legacy and versioned)
      const transaction = deserializeTransaction(data.transaction);

      return {
        vibeId: data.vibeId,
        transaction,
        blockhash: data.blockhash,
        lastValidBlockHeight: data.lastValidBlockHeight,
      };
    },
    [],
  );

  /**
   * Confirm vibe after signing
   */
  const confirmVibe = useCallback(
    async (params: ConfirmVibeParams): Promise<ConfirmVibeResult> => {
      // Serialize the signed transaction, handling both legacy and versioned
      const txBase64 = serializeSignedTransaction(params.signedTransaction);

      // Use fetchWithRetry because the app resumes from background after
      // MWA wallet signing, and the network connection may be stale
      const response = await fetchWithRetry(
        `${API_BASE_URL}/api/vibe/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vibeId: params.vibeId,
            signedTransaction: txBase64,
            blockhash: params.blockhash,
            lastValidBlockHeight: params.lastValidBlockHeight,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await extractApiError(response, 'Failed to confirm vibe'),
        );
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
        throw new Error(
          await extractApiError(response, 'Failed to get vibe details'),
        );
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
        throw new Error(
          await extractApiError(response, 'Failed to prepare claim'),
        );
      }

      const data = await response.json();

      // Deserialize the transaction (handles both legacy and versioned)
      const transaction = deserializeTransaction(data.transaction);

      return {
        transaction,
        blockhash: data.blockhash,
        lastValidBlockHeight: data.lastValidBlockHeight,
      };
    },
    [],
  );

  /**
   * Confirm claim after signing
   */
  const confirmClaim = useCallback(
    async (params: ConfirmVibeParams): Promise<void> => {
      // Serialize the signed transaction, handling both legacy and versioned
      const txBase64 = serializeSignedTransaction(params.signedTransaction);

      // Use fetchWithRetry because the app resumes from background after
      // MWA wallet signing, and the network connection may be stale
      const response = await fetchWithRetry(
        `${API_BASE_URL}/api/vibe/claim/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            vibeId: params.vibeId,
            signedTransaction: txBase64,
            blockhash: params.blockhash,
            lastValidBlockHeight: params.lastValidBlockHeight,
          }),
        },
      );

      if (!response.ok) {
        throw new Error(
          await extractApiError(response, 'Failed to confirm claim'),
        );
      }
    },
    [],
  );

  /**
   * Check if a given X username has a pending or claimed vibe.
   * Calls GET /api/vibe/pending/by-username?username=...
   * Returns { hasPending, hasClaimed, vibeId, vibeUrl, mintAddress, solscanUrl } or null.
   */
  const lookupVibeForUser = useCallback(
    async (username: string): Promise<{
      hasPending: boolean;
      hasClaimed: boolean;
      vibeId?: string;
      vibeUrl?: string;
      mintAddress?: string;
      solscanUrl?: string;
      senderWallet?: string;
    } | null> => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/vibe/pending/by-username?username=${encodeURIComponent(username)}`,
          {
            method: 'GET',
            headers: {'Content-Type': 'application/json'},
          },
        );
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.hasPending && !data.hasClaimed) return null;
        return data;
      } catch {
        // Endpoint unavailable — silently return null
        return null;
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
    lookupVibeForUser,
  };
}
