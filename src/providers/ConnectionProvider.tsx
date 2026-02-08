import React, {createContext, useContext, useMemo, ReactNode} from 'react';
import {Connection, clusterApiUrl} from '@solana/web3.js';
import {useWalletStore} from '../stores/walletStore';

interface ConnectionContextValue {
  connection: Connection;
  cluster: 'mainnet-beta' | 'devnet' | 'testnet';
}

const ConnectionContext = createContext<ConnectionContextValue | null>(null);

interface ConnectionProviderProps {
  children: ReactNode;
}

export function ConnectionProvider({children}: ConnectionProviderProps) {
  const cluster = useWalletStore(state => state.cluster);

  const connection = useMemo(() => {
    // Use environment variable or fallback to public RPC
    const rpcUrl = process.env.SOLANA_RPC_URL || clusterApiUrl(cluster);
    return new Connection(rpcUrl, 'confirmed');
  }, [cluster]);

  const value = useMemo(
    () => ({
      connection,
      cluster,
    }),
    [connection, cluster],
  );

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionContextValue {
  const context = useContext(ConnectionContext);
  if (!context) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}
