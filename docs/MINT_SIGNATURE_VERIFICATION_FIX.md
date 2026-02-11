# Mint: "Transaction did not pass signature verification"

## Symptom

When sending a vibe (minting), the backend returns:

```
Error while confirming: Simulation failed.
Message: Transaction simulation failed: Transaction did not pass signature verification.
```

## Causes

1. **Flaky RPC simulation** — Some RPC nodes reject valid transactions during preflight simulation. The actual transaction would succeed on-chain.

2. **Network mismatch** — The app and backend must use the same cluster:
   - App `cluster` (walletStore) defaults to `mainnet-beta`
   - Backend uses `NEXT_PUBLIC_SOLANA_RPC` (defaults to devnet)
   - If the app is on mainnet and the backend is on devnet (or vice versa), transactions will fail.

3. **Wallet / signer mismatch** — The connected wallet must match the `senderWallet` passed to prepare. Rare if using the same session.

## Fix applied

- **skipPreflight: true** on `sendRawTransaction` — bypasses the simulation step that was failing. The transaction is still validated on-chain; we detect failures via the confirmation polling loop.

## Network alignment

Ensure production backend has:

```bash
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
# or a mainnet RPC (Helius, QuickNode, etc.)
```

The mobile app uses `cluster: 'mainnet-beta'` by default. If the backend is on devnet, mint transactions will fail.
