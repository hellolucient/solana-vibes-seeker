import {create} from 'zustand';
import {PublicKey} from '@solana/web3.js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const WALLET_STORAGE_KEY = '@solanavibes/wallet';

interface WalletState {
  // Connection state
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  walletName: string | null;

  // Auth token from MWA authorization
  authToken: string | null;

  // Whether persisted state has been loaded
  hydrated: boolean;

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
  hydrate: () => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  // Initial state
  connected: false,
  connecting: false,
  publicKey: null,
  walletName: null,
  authToken: null,
  hydrated: false,
  cluster: 'mainnet-beta',

  // Actions
  setConnected: (connected, publicKey = null, walletName = null, authToken = null) => {
    set({
      connected,
      publicKey,
      walletName,
      authToken,
      connecting: false,
    });
    // Persist wallet state
    if (connected && publicKey) {
      AsyncStorage.setItem(
        WALLET_STORAGE_KEY,
        JSON.stringify({
          publicKey: publicKey.toBase58(),
          walletName,
          authToken,
        }),
      ).catch(err => console.warn('Failed to persist wallet:', err));
    }
  },

  setConnecting: connecting => set({connecting}),

  disconnect: () => {
    set({
      connected: false,
      publicKey: null,
      walletName: null,
      authToken: null,
      connecting: false,
    });
    // Clear persisted state
    AsyncStorage.removeItem(WALLET_STORAGE_KEY).catch(err =>
      console.warn('Failed to clear wallet:', err),
    );
  },

  setCluster: cluster => set({cluster}),

  // Load persisted wallet state on app start
  hydrate: async () => {
    try {
      const stored = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
      if (stored) {
        const {publicKey: pubKeyStr, walletName, authToken} = JSON.parse(stored);
        if (pubKeyStr) {
          set({
            connected: true,
            publicKey: new PublicKey(pubKeyStr),
            walletName,
            authToken,
            hydrated: true,
          });
          return;
        }
      }
    } catch (err) {
      console.warn('Failed to hydrate wallet:', err);
    }
    set({hydrated: true});
  },
}));

// Selector hooks for common patterns
export const useWalletConnected = () => useWalletStore(state => state.connected);
export const useWalletPublicKey = () => useWalletStore(state => state.publicKey);
