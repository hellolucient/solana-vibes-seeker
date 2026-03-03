import {useCallback} from 'react';
import {
  Transaction,
  VersionedTransaction,
  VersionedMessage,
  PublicKey,
} from '@solana/web3.js';

// Use your deployed backend
const API_BASE_URL =
  process.env.API_BASE_URL || 'https://solana-vibes-seeker.vercel.app';

/** Error from confirm API that may include retry fields (e.g. metadata_upload_failed) */
export type ConfirmVibeError = Error & {
  code?: string;
  vibeId?: string;
  mintAddress?: string;
};

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
  claimerWallet?: string;
}

interface ConfirmClaimParams {
  claimerWallet: string;
  vibeId?: string;
  signedTransaction?: Transaction | VersionedTransaction;
  blockhash?: string;
  lastValidBlockHeight?: number;
  signedTransactions?: Array<{
    vibeId: string;
    signedTransaction: Transaction | VersionedTransaction;
    blockhash: string;
    lastValidBlockHeight: number;
  }>;
}

interface ConfirmVibeResult {
  vibeId: string;
  vibeUrl: string;
  mintAddress: string;
}

interface PrepareClaimParams {
  vibeId?: string;
  vibeIds?: string[];
  claimerWallet: string;
  xUsername: string;
}

interface PrepareClaimResult {
  transaction?: Transaction | VersionedTransaction;
  blockhash?: string;
  lastValidBlockHeight?: number;
  /** When claiming multiple */
  transactions?: Array<{
    vibeId: string;
    transaction: Transaction | VersionedTransaction;
    blockhash: string;
    lastValidBlockHeight: number;
    feeSol: number;
  }>;
  feeSolPerNft?: number;
}

interface VibeDetails {
  id: string;
  targetUsername: string;
  senderWallet: string;
  maskedWallet: string;
  vibeNumber: number;
  imageUrl: string;
  claimStatus: 'pending' | 'claimed';
  mintAddress?: string;
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

      // Ensure fee payer is set for wallets that need it (like Seeker)
      // The fee payer should already be set from the backend, but some wallets
      // need it explicitly set on the deserialized transaction
      if (transaction instanceof Transaction) {
        // For legacy Transaction, ensure fee payer is set if not already
        if (!transaction.feePayer) {
          // Fee payer should be set from backend, but if missing, use sender wallet
          transaction.feePayer = new PublicKey(params.senderWallet);
        }
      }
      // VersionedTransaction fee payer is in the message header and should be preserved
      // We can't modify it after deserialization - it's read-only

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
   * Confirm vibe after signing.
   * Uses a timeout (100s) so the UI does not spin forever if the backend hangs.
   */
  const confirmVibe = useCallback(
    async (params: ConfirmVibeParams): Promise<ConfirmVibeResult> => {
      const txBase64 = serializeSignedTransaction(params.signedTransaction);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 100_000); // 100s

      try {
        const response = await fetchWithRetry(
          `${API_BASE_URL}/api/vibe/confirm`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              vibeId: params.vibeId,
              signedTransaction: txBase64,
              blockhash: params.blockhash,
              lastValidBlockHeight: params.lastValidBlockHeight,
            }),
            signal: controller.signal,
          },
        );
        clearTimeout(timeoutId);

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message =
            body?.message ||
            body?.error ||
            (typeof body?.error === 'string' ? body.error : 'Failed to confirm vibe');
          const err: ConfirmVibeError = new Error(
            typeof message === 'string' ? message : 'Failed to confirm vibe',
          ) as ConfirmVibeError;
          err.code = body?.error;
          err.vibeId = body?.vibeId;
          err.mintAddress = body?.mintAddress;
          throw err;
        }

        return response.json();
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof Error && err.name === 'AbortError') {
          throw new Error(
            'Confirmation timed out. The mint may still have succeeded — check your wallet or try again.',
          );
        }
        throw err;
      }
    },
    [],
  );

  /**
   * Retry completing metadata for a vibe that minted but had image/upload fail.
   */
  const completeMetadata = useCallback(
    async (vibeId: string): Promise<{ vibeId: string; vibeUrl: string; mintAddress?: string }> => {
      const response = await fetch(`${API_BASE_URL}/api/vibe/complete-metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vibeId }),
      });
      if (!response.ok) {
        const msg = await extractApiError(response, 'Failed to complete metadata');
        throw new Error(msg);
      }
      const data = await response.json();
      return {
        vibeId: data.vibeId,
        vibeUrl: data.vibeUrl,
        mintAddress: data.mintAddress,
      };
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

      const data = await response.json();
      // Normalize claimStatus: backend may return camelCase (claimStatus) or snake_case (claim_status).
      // Also treat presence of mintAddress/claimedAt as claimed when status is missing.
      const rawStatus = data.claimStatus ?? data.claim_status;
      const claimedAt = data.claimedAt ?? data.claimed_at;
      const hasClaimedSignals = !!(data.mintAddress ?? claimedAt);
      const claimStatus: 'pending' | 'claimed' =
        rawStatus === 'claimed' || (hasClaimedSignals && rawStatus !== 'pending')
          ? 'claimed'
          : rawStatus === 'pending'
            ? 'pending'
            : hasClaimedSignals
              ? 'claimed'
              : 'pending';
      return {
        ...data,
        imageUrl: data.imageUri || data.imageUrl || '',
        claimStatus,
        claimedAt: claimedAt ?? undefined,
      };
    },
    [],
  );

  /**
   * Prepare a claim transaction (single or multiple vibes).
   * Pass vibeIds for multi-claim (oldest first); vibeId for single.
   */
  const prepareClaim = useCallback(
    async (params: PrepareClaimParams): Promise<PrepareClaimResult> => {
      const body: Record<string, unknown> = {
        claimerWallet: params.claimerWallet,
        xUsername: params.xUsername,
      };
      if (params.vibeIds?.length) {
        body.vibeIds = params.vibeIds;
      } else if (params.vibeId) {
        body.vibeId = params.vibeId;
      }

      const response = await fetch(`${API_BASE_URL}/api/vibe/claim/prepare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(
          await extractApiError(response, 'Failed to prepare claim'),
        );
      }

      const data = await response.json();

      if (data.transactions && Array.isArray(data.transactions) && data.transactions.length > 0) {
        const transactions = data.transactions.map(
          (t: {
            vibeId: string;
            transaction: string;
            blockhash: string;
            lastValidBlockHeight: number;
            feeSol: number;
          }) => ({
            vibeId: t.vibeId,
            transaction: deserializeTransaction(t.transaction),
            blockhash: t.blockhash,
            lastValidBlockHeight: t.lastValidBlockHeight,
            feeSol: t.feeSol ?? 0.001,
          }),
        );
        return {
          transactions,
          feeSolPerNft: data.feeSolPerNft ?? 0.001,
        };
      }

      if (data.transaction && data.vibeId) {
        return {
          transaction: deserializeTransaction(data.transaction),
          blockhash: data.blockhash,
          lastValidBlockHeight: data.lastValidBlockHeight,
        };
      }

      throw new Error('Invalid response from server — missing transaction data');
    },
    [],
  );

  /**
   * Confirm claim after signing (single or multiple).
   */
  const confirmClaim = useCallback(
    async (params: ConfirmClaimParams): Promise<void> => {
      let body: Record<string, unknown> = {
        claimerWallet: params.claimerWallet,
      };

      if (
        params.signedTransactions &&
        Array.isArray(params.signedTransactions) &&
        params.signedTransactions.length > 0
      ) {
        body.signedTransactions = params.signedTransactions.map((t) => ({
          vibeId: t.vibeId,
          signedTransaction: serializeSignedTransaction(t.signedTransaction),
          blockhash: t.blockhash,
          lastValidBlockHeight: t.lastValidBlockHeight,
        }));
      } else if (
        params.vibeId &&
        params.signedTransaction &&
        params.blockhash != null &&
        params.lastValidBlockHeight != null
      ) {
        body.vibeId = params.vibeId;
        body.signedTransaction = serializeSignedTransaction(params.signedTransaction);
        body.blockhash = params.blockhash;
        body.lastValidBlockHeight = params.lastValidBlockHeight;
      } else {
        throw new Error('Missing signedTransaction or signedTransactions');
      }

      const response = await fetchWithRetry(
        `${API_BASE_URL}/api/vibe/claim/confirm`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
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
   * Returns { hasPending, hasClaimed, pendingCount, pendingVibes, vibeId, vibeUrl, ... } or null.
   */
  const lookupVibeForUser = useCallback(
    async (username: string): Promise<{
      hasPending: boolean;
      hasClaimed: boolean;
      pendingCount?: number;
      pendingVibes?: Array<{ id: string; createdAt: string; maskedWallet?: string; vibeIndexForRecipient?: number; imageUrl?: string }>;
      claimedCount?: number;
      claimedVibes?: Array<{
        id: string;
        vibeUrl?: string;
        imageUrl?: string;
        mintAddress?: string;
        solscanUrl?: string;
        createdAt?: string;
        claimedAt?: string;
        maskedWallet?: string;
      }>;
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
    completeMetadata,
    getVibeDetails,
    prepareClaim,
    confirmClaim,
    lookupVibeForUser,
  };
}
