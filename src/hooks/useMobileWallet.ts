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
  uri: 'https://solana-vibes.vercel.app',
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
        const authResult = await wallet.authorize({
          cluster: CLUSTER_MAP[cluster],
          identity: APP_IDENTITY,
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
      setError(err?.message || 'Failed to connect wallet');
      setConnecting(false);
      Alert.alert(
        'Connection Failed',
        err?.message || 'Failed to connect to wallet. Make sure you have a Solana wallet app installed.',
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

        // Sign the transaction
        // The web3js MWA adapter accepts Transaction[] directly
        let signedTxs: any[];
        try {
          // Try web3js wrapper format first (Transaction[])
          signedTxs = await wallet.signTransactions({
            transactions: [transaction],
          });
        } catch {
          // Fallback: some versions accept the array directly
          signedTxs = await wallet.signTransactions([transaction]);
        }

        const result = signedTxs[0];

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
