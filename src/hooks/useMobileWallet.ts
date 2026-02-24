import {useCallback, useState} from 'react';
import {Alert} from 'react-native';
import {
  Transaction,
  VersionedTransaction,
  PublicKey,
} from '@solana/web3.js';
import {useWalletStore} from '../stores/walletStore';
import {useConnection} from '../providers/ConnectionProvider';

// Lazy load MWA ONLY when user taps Connect
let mwaCache: {transact: any} | null = null;

function loadMWA(): {transact: any} | null {
  if (mwaCache !== null) return mwaCache;
  try {
    const mwa = require('@solana-mobile/mobile-wallet-adapter-protocol-web3js');
    mwaCache = {transact: mwa.transact};
    return mwaCache;
  } catch (e) {
    console.warn('MWA not available:', e);
    return null;
  }
}

// Decode a base64 string to Uint8Array
function toUint8Array(base64: string): Uint8Array {
  const raw = global.atob
    ? global.atob(base64)
    : Buffer.from(base64, 'base64').toString('binary');
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    arr[i] = raw.charCodeAt(i);
  }
  return arr;
}

// App identity for MWA authorization
const APP_IDENTITY = {
  name: 'Solana Vibes',
  uri: 'https://solana-vibes-seeker.vercel.app',
  icon: 'favicon.ico',
};

// Cluster mapping for MWA (uses raw Solana cluster names)
const CLUSTER_MAP = {
  'mainnet-beta': 'mainnet-beta',
  devnet: 'devnet',
  testnet: 'testnet',
} as const;

export function useMobileWallet() {
  const {cluster} = useConnection();
  const {
    connected,
    connecting,
    publicKey,
    authToken,
    setConnected,
    setConnecting,
    disconnect,
  } = useWalletStore();
  const [error, setError] = useState<string | null>(null);

  /**
   * Connect to a wallet using Mobile Wallet Adapter
   */
  const connect = useCallback(async () => {
    if (connecting || connected) return;

    // Load MWA only when user taps - prevents startup crash
    const mwa = loadMWA();
    if (!mwa?.transact) {
      Alert.alert(
        'Wallet Not Available',
        'Mobile Wallet Adapter is not available. Please install a Solana wallet app like Phantom or Solflare.',
      );
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      let didConnect = false;

      await mwa.transact(async (wallet: any) => {
        // Request authorization
        // Note: Seeker wallet may default to the most recently used wallet
        // If you need to select a different wallet, disconnect first and reconnect
        const authResult = await wallet.authorize({
          cluster: CLUSTER_MAP[cluster],
          identity: APP_IDENTITY,
        });

        // Log which wallet was selected for debugging
        console.log('[MWA] Authorization result:', {
          accounts: authResult.accounts?.length || 0,
          walletUri: authResult.wallet_uri_base,
        });

        // The MWA protocol returns the address as base64-encoded bytes
        const addressRaw = authResult.accounts[0].address;
        let walletPublicKey: PublicKey;
        try {
          // Try as base64 first (MWA protocol format)
          const decoded = toUint8Array(addressRaw);
          if (decoded.length === 32) {
            walletPublicKey = new PublicKey(decoded);
          } else {
            // Fallback: try as base58 string
            walletPublicKey = new PublicKey(addressRaw);
          }
        } catch {
          // Final fallback: treat as base58 string directly
          walletPublicKey = new PublicKey(addressRaw);
        }

        // Log which wallet was selected for debugging
        console.log('[MWA] Connected wallet:', walletPublicKey.toBase58());
        console.log('[MWA] Wallet URI:', authResult.wallet_uri_base);

        // Store connection state
        setConnected(
          true,
          walletPublicKey,
          authResult.wallet_uri_base || 'Mobile Wallet',
          authResult.auth_token,
        );
        didConnect = true;
      });

      if (!didConnect) {
        setConnecting(false);
      }
    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      const message = err?.message || 'Failed to connect wallet';
      const isCancelled = /cancelled|denied|user/i.test(message);
      setError(message);
      setConnecting(false);
      Alert.alert(
        'Connection Failed',
        message +
          (isCancelled
            ? '\n\nOn an emulator, install a Solana wallet (e.g. Phantom) or test on a real device with a wallet installed.'
            : ''),
      );
    }
  }, [cluster, connecting, connected, setConnected, setConnecting]);

  /**
   * Sign and send a transaction
   */
  const signAndSendTransaction = useCallback(
    async (
      transaction: Transaction | VersionedTransaction,
    ): Promise<string> => {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }

      const mwa = loadMWA();
      if (!mwa?.transact) {
        throw new Error('Mobile Wallet Adapter not available');
      }

      let signature: string = '';

      await mwa.transact(async (wallet: any) => {
        // Reauthorize with existing token if available
        if (authToken) {
          try {
            await wallet.reauthorize({
              auth_token: authToken,
              identity: APP_IDENTITY,
            });
          } catch {
            // Token expired, request new authorization
            await wallet.authorize({
              cluster: CLUSTER_MAP[cluster],
              identity: APP_IDENTITY,
            });
          }
        } else {
          await wallet.authorize({
            cluster: CLUSTER_MAP[cluster],
            identity: APP_IDENTITY,
          });
        }

        // Sign and send the transaction
        const signedTxs = await wallet.signAndSendTransactions({
          transactions: [transaction],
        });

        signature = signedTxs[0];
      });

      return signature;
    },
    [connected, publicKey, authToken, cluster],
  );

  /**
   * Sign a transaction without sending
   */
  const signTransaction = useCallback(
    async <T extends Transaction | VersionedTransaction>(
      transaction: T,
    ): Promise<T> => {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }

      const mwa = loadMWA();
      if (!mwa?.transact) {
        throw new Error('Mobile Wallet Adapter not available');
      }

      // Validate transaction before signing
      if (!transaction) {
        throw new Error('Transaction is null or undefined');
      }
      
      if (!(transaction instanceof Transaction) && !(transaction instanceof VersionedTransaction)) {
        throw new Error(`Invalid transaction type: ${typeof transaction}. Expected Transaction or VersionedTransaction`);
      }

      let signedTx: T | null = null;

      await mwa.transact(async (wallet: any) => {
        // Reauthorize
        if (authToken) {
          try {
            await wallet.reauthorize({
              auth_token: authToken,
              identity: APP_IDENTITY,
            });
          } catch {
            await wallet.authorize({
              cluster: CLUSTER_MAP[cluster],
              identity: APP_IDENTITY,
            });
          }
        } else {
          await wallet.authorize({
            cluster: CLUSTER_MAP[cluster],
            identity: APP_IDENTITY,
          });
        }

        // Ensure transaction is properly formatted
        // Some wallets (like Seeker) may be sensitive to transaction format
        const txArray = Array.isArray(transaction) ? transaction : [transaction];
        
        // Log transaction structure for debugging Seeker wallet issues
        console.log('[MWA] Transaction type:', transaction.constructor.name);
        if (transaction instanceof VersionedTransaction) {
          console.log('[MWA] VersionedTransaction - message header:', transaction.message.header);
          console.log('[MWA] VersionedTransaction - num required signatures:', transaction.message.header.numRequiredSignatures);
          console.log('[MWA] VersionedTransaction - num readonly signed accounts:', transaction.message.header.numReadonlySignedAccounts);
          console.log('[MWA] VersionedTransaction - num readonly unsigned accounts:', transaction.message.header.numReadonlyUnsignedAccounts);
          console.log('[MWA] VersionedTransaction - account keys length:', transaction.message.staticAccountKeys?.length || 'undefined');
          console.log('[MWA] VersionedTransaction - instructions length:', transaction.message.compiledInstructions?.length || 'undefined');
        } else if (transaction instanceof Transaction) {
          console.log('[MWA] Legacy Transaction - fee payer:', transaction.feePayer?.toBase58());
          console.log('[MWA] Legacy Transaction - instructions length:', transaction.instructions?.length || 'undefined');
          console.log('[MWA] Legacy Transaction - signatures length:', transaction.signatures?.length || 'undefined');
        }
        
        // Sign the transaction
        // The web3js MWA adapter accepts Transaction[] directly
        let signedTxs: any;
        try {
          // Try web3js wrapper format first (Transaction[])
          signedTxs = await wallet.signTransactions({
            transactions: txArray,
          });
        } catch (err) {
          console.warn('[MWA] Wrapper format failed, trying direct array:', err);
          // Fallback: some versions accept the array directly
          try {
            signedTxs = await wallet.signTransactions(txArray);
          } catch (err2) {
            console.error('[MWA] Both signTransactions formats failed:', err2);
            // Log more details for debugging
            console.error('[MWA] Transaction type:', transaction.constructor.name);
            console.error('[MWA] Transaction keys:', Object.keys(transaction));
            if (transaction instanceof VersionedTransaction) {
              console.error('[MWA] VersionedTransaction message:', transaction.message);
            }
            throw new Error(`Failed to sign transaction: ${err2 instanceof Error ? err2.message : 'Unknown error'}`);
          }
        }

        // Handle different return formats
        if (!signedTxs) {
          throw new Error('signTransactions returned undefined');
        }

        // Some wallets return an array directly, others return an object with a transactions property
        let result: any;
        if (Array.isArray(signedTxs)) {
          result = signedTxs[0];
        } else if (signedTxs.transactions && Array.isArray(signedTxs.transactions)) {
          result = signedTxs.transactions[0];
        } else if (signedTxs.transaction) {
          result = signedTxs.transaction;
        } else {
          // Try to use it directly if it's already a transaction
          result = signedTxs;
        }

        if (!result) {
          throw new Error('No signed transaction found in response');
        }

        // Handle the case where MWA returns raw bytes instead of Transaction objects
        if (result instanceof Uint8Array || ArrayBuffer.isView(result)) {
          // Re-deserialize from raw bytes
          const bytes = Buffer.from(result as Uint8Array);
          try {
            signedTx = VersionedTransaction.deserialize(bytes) as T;
          } catch {
            signedTx = Transaction.from(bytes) as T;
          }
        } else {
          signedTx = result as T;
        }

        // Verify the signed transaction's fee payer matches the connected wallet
        // This prevents issues where a different wallet is selected in Seeker's UI
        // The fee payer is the first account in VersionedTransaction
        if (signedTx instanceof VersionedTransaction) {
          const feePayer = signedTx.message.staticAccountKeys[0];
          if (feePayer && !feePayer.equals(publicKey)) {
            const errorMsg = 
              `Wallet mismatch: Transaction was signed by ${feePayer.toBase58()} ` +
              `but app is connected to ${publicKey.toBase58()}. ` +
              `Please disconnect and reconnect with the correct wallet, or select the same wallet in Seeker's UI.`;
            console.error('[MWA]', errorMsg);
            throw new Error(errorMsg);
          }
        } else if (signedTx instanceof Transaction) {
          if (signedTx.feePayer && !signedTx.feePayer.equals(publicKey)) {
            const errorMsg = 
              `Wallet mismatch: Transaction was signed by ${signedTx.feePayer.toBase58()} ` +
              `but app is connected to ${publicKey.toBase58()}. ` +
              `Please disconnect and reconnect with the correct wallet, or select the same wallet in Seeker's UI.`;
            console.error('[MWA]', errorMsg);
            throw new Error(errorMsg);
          }
        }
      });

      if (!signedTx) {
        throw new Error('Failed to sign transaction');
      }

      return signedTx;
    },
    [connected, publicKey, authToken, cluster],
  );

  /**
   * Sign a message
   */
  const signMessage = useCallback(
    async (message: Uint8Array): Promise<Uint8Array> => {
      if (!connected || !publicKey) {
        throw new Error('Wallet not connected');
      }

      const mwa = loadMWA();
      if (!mwa?.transact) {
        throw new Error('Mobile Wallet Adapter not available');
      }

      let signedMessage: Uint8Array | null = null;

      await mwa.transact(async (wallet: any) => {
        // Reauthorize
        if (authToken) {
          try {
            await wallet.reauthorize({
              auth_token: authToken,
              identity: APP_IDENTITY,
            });
          } catch {
            await wallet.authorize({
              cluster: CLUSTER_MAP[cluster],
              identity: APP_IDENTITY,
            });
          }
        } else {
          await wallet.authorize({
            cluster: CLUSTER_MAP[cluster],
            identity: APP_IDENTITY,
          });
        }

        // Sign the message
        const signedMessages = await wallet.signMessages({
          addresses: [publicKey.toBase58()],
          payloads: [message],
        });

        signedMessage = signedMessages[0];
      });

      if (!signedMessage) {
        throw new Error('Failed to sign message');
      }

      return signedMessage;
    },
    [connected, publicKey, authToken, cluster],
  );

  return {
    connected,
    connecting,
    publicKey,
    connect,
    disconnect,
    signTransaction,
    signAndSendTransaction,
    signMessage,
    error,
    isMWAAvailable: mwaCache !== null,
  };
}
