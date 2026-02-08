import {useCallback} from 'react';
import {
  transact,
  Web3MobileWallet,
} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
  Transaction,
  VersionedTransaction,
  PublicKey,
} from '@solana/web3.js';
import {useWalletStore} from '../stores/walletStore';
import {useConnection} from '../providers/ConnectionProvider';

// App identity for MWA authorization
const APP_IDENTITY = {
  name: 'Solana Vibes',
  uri: 'https://solana-vibes.vercel.app',
  icon: 'favicon.ico',
};

// Cluster mapping for MWA
const CLUSTER_MAP = {
  'mainnet-beta': 'solana:mainnet',
  devnet: 'solana:devnet',
  testnet: 'solana:testnet',
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

  /**
   * Connect to a wallet using Mobile Wallet Adapter
   */
  const connect = useCallback(async () => {
    if (connecting || connected) return;

    setConnecting(true);

    try {
      await transact(async (wallet: Web3MobileWallet) => {
        // Request authorization
        const authResult = await wallet.authorize({
          cluster: CLUSTER_MAP[cluster],
          identity: APP_IDENTITY,
        });

        // Extract public key from first account
        const walletPublicKey = new PublicKey(authResult.accounts[0].address);

        // Store connection state
        setConnected(
          true,
          walletPublicKey,
          authResult.wallet_uri_base || 'Mobile Wallet',
          authResult.auth_token,
        );
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      setConnecting(false);
      throw error;
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

      let signature: string = '';

      await transact(async (wallet: Web3MobileWallet) => {
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

      let signedTx: T | null = null;

      await transact(async (wallet: Web3MobileWallet) => {
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
        const signedTxs = await wallet.signTransactions({
          transactions: [transaction],
        });

        signedTx = signedTxs[0] as T;
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

      let signedMessage: Uint8Array | null = null;

      await transact(async (wallet: Web3MobileWallet) => {
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
  };
}
