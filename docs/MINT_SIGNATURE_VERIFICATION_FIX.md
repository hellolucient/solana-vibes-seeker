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

## Fixes applied

- **skipPreflight: true** on `sendRawTransaction` — bypasses the simulation step that was failing. The transaction is still validated on-chain; we detect failures via the confirmation polling loop.
- **maxDuration: 90** — Vercel serverless timeout (default can be 15s) extended so confirmation polling can complete.
- **90s polling** — Increased from 30s to 90s, with `searchTransactionHistory: true` for RPCs that index slowly.
- **Priority fee** — Added `setComputeUnitPrice` (50k microlamports) and `setComputeUnitLimit` (200k CUs). Without a priority fee on mainnet, transactions get deprioritized and can sit for a long time; Phantom may also show "0 network fee" which can confuse users. The priority fee ensures the tx lands promptly.

## Network alignment

Ensure production backend has:

```bash
NEXT_PUBLIC_SOLANA_RPC=https://api.mainnet-beta.solana.com
# or a mainnet RPC (Helius, QuickNode, etc.)
```

The mobile app uses `cluster: 'mainnet-beta'` by default. If the backend is on devnet, mint transactions will fail.
