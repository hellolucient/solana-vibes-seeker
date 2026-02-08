import {create} from 'zustand';
import {PublicKey} from '@solana/web3.js';

interface WalletState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  walletName: string | null;

  // Auth token from MWA authorization
  authToken: string | null;

  // Network configuration
  cluster: 'mainnet-beta' | 'devnet' | 'testnet';

  // Actions
  setConnected: (
    connected: boolean,
    publicKey?: PublicKey | null,
    walletName?: string | null,
    authToken?: string | null,
  ) => void;
  setConnecting: (connecting: boolean) => void;
  disconnect: () => void;
  setCluster: (cluster: 'mainnet-beta' | 'devnet' | 'testnet') => void;
}

export const useWalletStore = create<WalletState>(set => ({
  // Initial state
  connected: false,
  connecting: false,
  publicKey: null,
  walletName: null,
  authToken: null,
  cluster: 'mainnet-beta',

  // Actions
  setConnected: (connected, publicKey = null, walletName = null, authToken = null) =>
    set({
      connected,
      publicKey,
      walletName,
      authToken,
      connecting: false,
    }),

  setConnecting: connecting => set({connecting}),

  disconnect: () =>
    set({
      connected: false,
      publicKey: null,
      walletName: null,
      authToken: null,
      connecting: false,
    }),

  setCluster: cluster => set({cluster}),
}));

// Selector hooks for common patterns
export const useWalletConnected = () => useWalletStore(state => state.connected);
export const useWalletPublicKey = () => useWalletStore(state => state.publicKey);
